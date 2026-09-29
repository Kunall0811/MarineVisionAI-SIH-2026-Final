import { Injectable } from '@nestjs/common';
import { PerClassMetric, TrainingMetrics } from './schemas/training-job.schema';
import { FEATURE_NAMES } from './feature-extractor';

export interface LabeledSample {
  features: number[];
  label: number; // class index
}

export interface TrainedWeights {
  W: number[][]; // [numClasses][numFeatures]
  b: number[]; // [numClasses]
}

function softmax(logits: number[]): number[] {
  const max = Math.max(...logits);
  const exps = logits.map((l) => Math.exp(l - max));
  const sum = exps.reduce((a, c) => a + c, 0) || 1e-9;
  return exps.map((e) => e / sum);
}

/**
 * Real multinomial logistic-regression (softmax) trainer, optimized by
 * mini-batch gradient descent over hand-crafted pixel-statistics features
 * (see feature-extractor.ts). This is a genuinely trained classifier -
 * weights are updated from actual gradients of cross-entropy loss on the
 * provided TRAIN split, and every metric below is computed from real
 * predictions on a held-out split. It is intentionally lightweight (no
 * native ML framework / GPU dependency) so it runs in a plain Node.js
 * backend, consistent with "no Python in production".
 */
@Injectable()
export class TrainerService {
  train(
    trainSet: LabeledSample[],
    numClasses: number,
    epochs: number,
    learningRate: number,
    batchSize: number,
    onEpoch?: (epoch: number, loss: number) => void,
  ): { weights: TrainedWeights; finalLoss: number; epochsRun: number } {
    const numFeatures = FEATURE_NAMES.length;
    let W: number[][] = Array.from({ length: numClasses }, () => Array(numFeatures).fill(0));
    let b: number[] = Array(numClasses).fill(0);

    let lastLoss = Infinity;
    let epochsRun = 0;

    for (let epoch = 0; epoch < epochs; epoch++) {
      const shuffled = [...trainSet].sort(() => Math.random() - 0.5);
      let epochLoss = 0;
      let batches = 0;

      for (let i = 0; i < shuffled.length; i += batchSize) {
        const batch = shuffled.slice(i, i + batchSize);
        if (!batch.length) continue;

        const gradW: number[][] = Array.from({ length: numClasses }, () => Array(numFeatures).fill(0));
        const gradB: number[] = Array(numClasses).fill(0);
        let batchLoss = 0;

        for (const sample of batch) {
          const logits = W.map((row, c) => row.reduce((s, w, f) => s + w * sample.features[f], b[c]));
          const probs = softmax(logits);
          const trueClass = sample.label;
          batchLoss += -Math.log(Math.max(probs[trueClass], 1e-9));

          for (let c = 0; c < numClasses; c++) {
            const err = probs[c] - (c === trueClass ? 1 : 0);
            for (let f = 0; f < numFeatures; f++) {
              gradW[c][f] += err * sample.features[f];
            }
            gradB[c] += err;
          }
        }

        const n = batch.length;
        for (let c = 0; c < numClasses; c++) {
          for (let f = 0; f < numFeatures; f++) {
            W[c][f] -= (learningRate * gradW[c][f]) / n;
          }
          b[c] -= (learningRate * gradB[c]) / n;
        }

        epochLoss += batchLoss / n;
        batches++;
      }

      lastLoss = batches ? epochLoss / batches : lastLoss;
      epochsRun = epoch + 1;
      onEpoch?.(epochsRun, lastLoss);
    }

    return { weights: { W, b }, finalLoss: lastLoss, epochsRun };
  }

  predict(weights: TrainedWeights, features: number[]): { classIndex: number; probs: number[] } {
    const logits = weights.W.map((row, c) => row.reduce((s, w, f) => s + w * features[f], weights.b[c]));
    const probs = softmax(logits);
    let best = 0;
    for (let c = 1; c < probs.length; c++) if (probs[c] > probs[best]) best = c;
    return { classIndex: best, probs };
  }

  evaluate(
    weights: TrainedWeights,
    evalSet: LabeledSample[],
    classLabels: string[],
    inferenceLatenciesMs: number[],
  ): TrainingMetrics {
    const numClasses = classLabels.length;
    const confusionMatrix: number[][] = Array.from({ length: numClasses }, () => Array(numClasses).fill(0));

    let correct = 0;
    for (const sample of evalSet) {
      const { classIndex } = this.predict(weights, sample.features);
      confusionMatrix[sample.label][classIndex]++;
      if (classIndex === sample.label) correct++;
    }

    const perClass: PerClassMetric[] = classLabels.map((label, c) => {
      const tp = confusionMatrix[c][c];
      const support = confusionMatrix[c].reduce((a, x) => a + x, 0);
      const predictedAsC = confusionMatrix.reduce((a, row) => a + row[c], 0);
      const precision = predictedAsC ? tp / predictedAsC : 0;
      const recall = support ? tp / support : 0;
      const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
      return { class: label, precision: round(precision), recall: round(recall), f1: round(f1), support };
    });

    const precisionMacro = round(perClass.reduce((a, c) => a + c.precision, 0) / (numClasses || 1));
    const recallMacro = round(perClass.reduce((a, c) => a + c.recall, 0) / (numClasses || 1));
    const f1Macro = round(perClass.reduce((a, c) => a + c.f1, 0) / (numClasses || 1));
    const accuracy = round(evalSet.length ? correct / evalSet.length : 0);

    const sortedLatencies = [...inferenceLatenciesMs].sort((a, b) => a - b);
    const p50 = percentile(sortedLatencies, 50);
    const p95 = percentile(sortedLatencies, 95);

    return {
      trainSamples: 0, // filled in by caller
      valSamples: evalSet.length,
      testSamples: 0,
      epochsRun: 0,
      finalTrainLoss: 0,
      accuracy,
      precisionMacro,
      recallMacro,
      f1Macro,
      perClass,
      confusionMatrix,
      classLabels,
      inferenceLatencyMsP50: round(p50),
      inferenceLatencyMsP95: round(p95),
      mAP50: null,
      mAP50_95: null,
      metricsNote:
        'This pipeline trains a lightweight whole-image classifier (softmax regression over pixel-statistics features), not a bounding-box object detector. Precision/recall/F1/confusion-matrix/accuracy above are real, computed on a held-out split. mAP50/mAP50-95 are left null because they require IoU-based bounding-box evaluation, which this classifier does not perform - plug a trained YOLO ONNX model into ONNX_MODEL_PATH for real detection-based mAP.',
    };
  }
}

function round(x: number): number {
  return Math.round(x * 1000) / 1000;
}

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}
