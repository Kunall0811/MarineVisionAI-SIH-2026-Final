import { Injectable } from '@nestjs/common';
import { MemoryStore } from '../../store/memoryStore';
import { TrainingJob } from '../../store/types';

export interface StartTrainingInput {
  datasetId: string;
  epochs: number;
  learningRate: number;
  batchSize: number;
  valSplit: number;
  testSplit: number;
  useAugmentation: boolean;
  createdBy: string;
}

@Injectable()
export class AiTrainingService {
  private processor?: any;

  constructor(private readonly store: MemoryStore) {}

  private get jobModel() {
    return this.store.trainingJobs;
  }

  setProcessor(proc: any) {
    this.processor = proc;
  }

  async startJob(input: StartTrainingInput) {
    const job = await this.jobModel.create({
      datasetId: input.datasetId,
      hyperparameters: {
        epochs: input.epochs,
        learningRate: input.learningRate,
        batchSize: input.batchSize,
        valSplit: input.valSplit,
        testSplit: input.testSplit,
        useAugmentation: input.useAugmentation,
        architecture: 'lightweight-softmax-classifier-v1',
      },
      status: 'QUEUED',
      createdBy: input.createdBy,
    });

    if (this.processor) {
      setImmediate(() => {
        this.processor?.process({ data: { trainingJobId: String(job._id) } }).catch((err: any) => {
          console.error('In-process training execution failed:', err);
        });
      });
    }

    return job;
  }

  findAll(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    return Promise.all([
      this.jobModel.find().sort({ createdAt: -1 }).skip(skip).limit(limit).exec(),
      this.jobModel.countDocuments().exec(),
    ]);
  }

  findById(id: string) {
    return this.jobModel.findById(id).exec();
  }

  update(id: string, update: Partial<TrainingJob>) {
    return this.jobModel.findByIdAndUpdate(id, update, { new: true }).exec();
  }

  appendLog(id: string, line: string) {
    return this.jobModel.findByIdAndUpdate(id, { $push: { logLines: `[${new Date().toISOString()}] ${line}` } }).exec();
  }
}
