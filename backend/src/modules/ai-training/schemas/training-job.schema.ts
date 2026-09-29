import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type TrainingJobDocument = TrainingJob & Document;

export interface PerClassMetric {
  class: string;
  precision: number;
  recall: number;
  f1: number;
  support: number;
}

export interface TrainingMetrics {
  trainSamples: number;
  valSamples: number;
  testSamples: number;
  epochsRun: number;
  finalTrainLoss: number;
  accuracy: number;
  precisionMacro: number;
  recallMacro: number;
  f1Macro: number;
  perClass: PerClassMetric[];
  confusionMatrix: number[][]; // rows = true class, cols = predicted class, order = classLabels
  classLabels: string[];
  inferenceLatencyMsP50: number;
  inferenceLatencyMsP95: number;
  // mAP is intentionally left null: this pipeline trains a whole-frame
  // classifier (no bounding-box regression), so a real IoU-based mAP50 /
  // mAP50-95 cannot be computed honestly from it. See metricsNote.
  mAP50: number | null;
  mAP50_95: number | null;
  metricsNote: string;
}

@Schema({ timestamps: true, collection: 'ai_training_jobs' })
export class TrainingJob {
  _id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Dataset', required: true, index: true })
  datasetId: Types.ObjectId;

  @Prop({
    type: {
      epochs: Number,
      learningRate: Number,
      batchSize: Number,
      valSplit: Number,
      testSplit: Number,
      useAugmentation: Boolean,
      architecture: String,
    },
    required: true,
  })
  hyperparameters: {
    epochs: number;
    learningRate: number;
    batchSize: number;
    valSplit: number;
    testSplit: number;
    useAugmentation: boolean;
    architecture: string;
  };

  @Prop({ enum: ['QUEUED', 'RUNNING', 'COMPLETED', 'FAILED'], default: 'QUEUED', index: true })
  status: string;

  @Prop({ default: 0 })
  progressPct: number;

  @Prop({ type: [String], default: [] })
  logLines: string[];

  @Prop({ type: Object, default: null })
  metrics: TrainingMetrics | null;

  @Prop({ type: String, default: null })
  errorMessage: string | null;

  @Prop({ type: Types.ObjectId, ref: 'ModelVersion', default: null })
  resultingModelVersionId: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy: Types.ObjectId;

  @Prop({ type: Date, default: null })
  startedAt: Date | null;

  @Prop({ type: Date, default: null })
  completedAt: Date | null;

  createdAt: Date;
  updatedAt: Date;
}

export const TrainingJobSchema = SchemaFactory.createForClass(TrainingJob);
TrainingJobSchema.index({ createdAt: -1 });
