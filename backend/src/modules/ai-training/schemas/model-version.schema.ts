import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ModelVersionDocument = ModelVersion & Document;

@Schema({ timestamps: true, collection: 'ai_model_versions' })
export class ModelVersion {
  _id: Types.ObjectId;

  @Prop({ required: true, unique: true })
  version: string; // e.g. "sonar-classifier-v3"

  @Prop({ required: true, default: 'lightweight-softmax-classifier-v1' })
  architecture: string;

  @Prop({ type: Types.ObjectId, ref: 'Dataset', required: true })
  datasetId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'TrainingJob', required: true })
  trainingJobId: Types.ObjectId;

  @Prop({ type: Object, required: true })
  metricsSnapshot: Record<string, any>;

  @Prop({ type: [String], required: true })
  classLabels: string[];

  @Prop({ type: [String], required: true })
  featureNames: string[];

  @Prop({ required: true })
  weightsStoragePath: string; // JSON weights (portable, human-inspectable)

  @Prop({ required: true })
  onnxStoragePath: string; // real, structurally-valid ONNX export (Gemm+Softmax graph)

  @Prop({ default: false, index: true })
  isActive: boolean;

  // Model quality gate (spec section 31). A model can only be activated
  // once it has gone through evaluation - it is never fabricated or
  // auto-passed.
  //   EXPERIMENTAL        - trained but not yet evaluated on a held-out
  //                          test split (or evaluated on too little data
  //                          to mean anything, e.g. a ml/ smoke test run)
  //   VALIDATED            - real test-split metrics exist in metricsSnapshot
  //   PRODUCTION_CANDIDATE - an admin has reviewed the metrics and marked
  //                          it a candidate for activation
  //   ACTIVE                - currently serving inference (exactly one
  //                          model version has this state at a time)
  @Prop({
    enum: ['EXPERIMENTAL', 'VALIDATED', 'PRODUCTION_CANDIDATE', 'ACTIVE'],
    default: 'EXPERIMENTAL',
    index: true,
  })
  qualityState: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy: Types.ObjectId;

  createdAt: Date;
  updatedAt: Date;
}

export const ModelVersionSchema = SchemaFactory.createForClass(ModelVersion);
