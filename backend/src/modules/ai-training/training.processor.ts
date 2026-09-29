import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { AiTrainingService } from './ai-training.service';
import { DatasetsService } from './datasets.service';
import { ModelVersionsService } from './model-versions.service';
import { StorageService } from '../storage/storage.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { extractFeatures, augmentImage, FEATURE_NAMES } from './feature-extractor';
import { TrainerService, LabeledSample } from './trainer.service';
import { exportToOnnx } from './onnx-exporter';

@Injectable()
export class AiTrainingProcessor implements OnModuleInit {
  private readonly logger = new Logger('AiTrainingProcessor');
  private readonly modelsRoot: string;

  constructor(
    private trainingJobs: AiTrainingService,
    private datasets: DatasetsService,
    private modelVersions: ModelVersionsService,
    private storage: StorageService,
    private trainer: TrainerService,
    private realtime: RealtimeGateway,
  ) {
    this.modelsRoot = path.resolve(process.env.STORAGE_LOCAL_PATH || './sonar-storage', '..', 'ai-models', 'trained');
    if (!fs.existsSync(this.modelsRoot)) fs.mkdirSync(this.modelsRoot, { recursive: true });
  }

  onModuleInit() {
    this.trainingJobs.setProcessor(this);
  }

  async process(job: { data: { trainingJobId: string } }): Promise<any> {
    const trainingJobId = job.data.trainingJobId;
    const trainingJob = await this.trainingJobs.findById(trainingJobId);
    if (!trainingJob) throw new Error('Training job not found');

    const startTime = Date.now();
    const emit = (progressPct: number, status: string) => {
      const elapsedSeconds = Math.max(1, Math.round((Date.now() - startTime) / 1000));
      let etaSeconds = 0;
      if (progressPct > 0 && progressPct < 100) {
        const estTotal = elapsedSeconds / (progressPct / 100);
        etaSeconds = Math.max(0, Math.round(estTotal - elapsedSeconds));
      }
      const formattedEta =
        progressPct >= 100
          ? 'Completed'
          : etaSeconds > 60
          ? `${Math.floor(etaSeconds / 60)}m ${etaSeconds % 60}s remaining`
          : `${etaSeconds}s remaining`;

      this.realtime.emitEvent('training_progress', {
        trainingJobId,
        progressPct,
        status,
        elapsedSeconds,
        etaSeconds,
        formattedEta,
      });
    };

    try {
      await this.trainingJobs.update(trainingJobId, { status: 'RUNNING', startedAt: new Date() });
      emit(1, 'RUNNING');

      const dataset = await this.datasets.findById(String(trainingJob.datasetId));
      const classLabels = dataset.classes;
      const { hyperparameters: hp } = trainingJob;

      // Auto-split if the dataset wasn't explicitly split first.
      if (dataset.status === 'DRAFT') {
        await this.datasets.applySplit(String(dataset._id), hp.valSplit, hp.testSplit);
        await this.trainingJobs.appendLog(trainingJobId, `Dataset had no manual split - auto-applied ${hp.valSplit * 100}% val / ${hp.testSplit * 100}% test.`);
      }

      const [trainImages, valImages, testImages] = await Promise.all([
        this.datasets.imagesBySplit(String(dataset._id), 'TRAIN'),
        this.datasets.imagesBySplit(String(dataset._id), 'VAL'),
        this.datasets.imagesBySplit(String(dataset._id), 'TEST'),
      ]);

      if (trainImages.length === 0) throw new Error('No TRAIN-split images available for this dataset.');
      if (valImages.length === 0) throw new Error('No VAL-split images available - upload more images or lower valSplit.');

      await this.trainingJobs.appendLog(
        trainingJobId,
        `Split sizes - train:${trainImages.length} val:${valImages.length} test:${testImages.length}`,
      );
      emit(10, 'RUNNING');

      const labelIndex = new Map(classLabels.map((c, i) => [c, i]));
      const buildSamples = async (images: any[], augment: boolean): Promise<LabeledSample[]> => {
        const samples: LabeledSample[] = [];
        for (const img of images) {
          const buffer = this.storage.readFile(img.storagePath);
          const features = await extractFeatures(buffer);
          samples.push({ features, label: labelIndex.get(img.label)! });

          if (augment) {
            for (let v = 1; v <= 2; v++) {
              const augBuffer = await augmentImage(buffer, v);
              const augFeatures = await extractFeatures(augBuffer);
              samples.push({ features: augFeatures, label: labelIndex.get(img.label)! });
            }
          }
        }
        return samples;
      };

      const trainSamples = await buildSamples(trainImages, hp.useAugmentation);
      emit(35, 'RUNNING');
      const valSamples = await buildSamples(valImages, false);
      emit(45, 'RUNNING');
      const testSamples = testImages.length ? await buildSamples(testImages, false) : [];
      emit(50, 'RUNNING');

      await this.trainingJobs.appendLog(
        trainingJobId,
        `Feature extraction complete (train samples incl. augmentation: ${trainSamples.length}).`,
      );

      const { weights, finalLoss, epochsRun } = this.trainer.train(
        trainSamples,
        classLabels.length,
        hp.epochs,
        hp.learningRate,
        hp.batchSize,
        (epoch, loss) => {
          if (epoch % Math.max(1, Math.floor(hp.epochs / 10)) === 0) {
            const pct = 50 + Math.round((epoch / hp.epochs) * 35);
            const elapsed = Math.max(1, Math.round((Date.now() - startTime) / 1000));
            const estTotal = elapsed / (pct / 100);
            const remaining = Math.max(0, Math.round(estTotal - elapsed));
            this.trainingJobs.appendLog(
              trainingJobId,
              `Epoch ${epoch}/${hp.epochs} - loss ${loss.toFixed(4)} [${remaining}s ETA]`,
            );
            emit(pct, 'RUNNING');
          }
        },
      );

      emit(85, 'RUNNING');

      // Measure real per-sample inference latency on the val set.
      const latencies: number[] = [];
      for (const s of valSamples) {
        const t0 = process.hrtime.bigint();
        this.trainer.predict(weights, s.features);
        const t1 = process.hrtime.bigint();
        latencies.push(Number(t1 - t0) / 1e6);
      }

      const evalSet = testSamples.length ? testSamples : valSamples;
      const metrics = this.trainer.evaluate(weights, evalSet, classLabels, latencies);
      metrics.trainSamples = trainSamples.length;
      metrics.valSamples = valSamples.length;
      metrics.testSamples = testSamples.length;
      metrics.epochsRun = epochsRun;
      metrics.finalTrainLoss = Math.round(finalLoss * 10000) / 10000;

      await this.trainingJobs.appendLog(
        trainingJobId,
        `Training complete - accuracy ${(metrics.accuracy * 100).toFixed(1)}%, macro-F1 ${(metrics.f1Macro * 100).toFixed(1)}% on ${testSamples.length ? 'TEST' : 'VAL'} split.`,
      );
      emit(92, 'RUNNING');

      // Version + export.
      const existingVersions = await this.modelVersions.findAll();
      const versionLabel = `sonar-classifier-v${existingVersions.length + 1}`;

      const weightsFileName = `${versionLabel}.weights.json`;
      const onnxFileName = `${versionLabel}.onnx`;
      fs.writeFileSync(
        path.join(this.modelsRoot, weightsFileName),
        JSON.stringify({ W: weights.W, b: weights.b, featureNames: FEATURE_NAMES, classLabels }, null, 2),
      );
      const onnxBuffer = exportToOnnx(weights, FEATURE_NAMES, classLabels, versionLabel);
      fs.writeFileSync(path.join(this.modelsRoot, onnxFileName), onnxBuffer);

      const modelVersion = await this.modelVersions.create({
        version: versionLabel,
        architecture: 'lightweight-softmax-classifier-v1',
        datasetId: dataset._id,
        trainingJobId: trainingJob._id,
        metricsSnapshot: metrics,
        classLabels,
        featureNames: FEATURE_NAMES,
        weightsStoragePath: path.join('ai-models', 'trained', weightsFileName),
        onnxStoragePath: path.join('ai-models', 'trained', onnxFileName),
        isActive: false,
        createdBy: trainingJob.createdBy,
      });

      await this.trainingJobs.update(trainingJobId, {
        status: 'COMPLETED',
        progressPct: 100,
        metrics,
        resultingModelVersionId: modelVersion._id,
        completedAt: new Date(),
      });

      emit(100, 'COMPLETED');
      this.realtime.emitEvent('training_completed', { trainingJobId, modelVersionId: modelVersion._id, version: versionLabel });

      return { trainingJobId, modelVersionId: modelVersion._id };
    } catch (err: any) {
      this.logger.error(`Training job ${trainingJobId} failed: ${err.message}`, err.stack);
      await this.trainingJobs.update(trainingJobId, { status: 'FAILED', errorMessage: err.message, completedAt: new Date() });
      await this.trainingJobs.appendLog(trainingJobId, `FAILED: ${err.message}`);
      emit(0, 'FAILED');
      throw err;
    }
  }
}
