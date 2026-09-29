import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type SonarFrameDocument = SonarFrame & Document;

@Schema({ timestamps: true, collection: 'sonar_frames' })
export class SonarFrame {
  _id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Survey', required: true, index: true })
  surveyId: Types.ObjectId;

  @Prop({ required: true })
  fileName: string;

  @Prop({ required: true })
  storagePath: string;

  @Prop({ required: true })
  fileHash: string;

  @Prop({ required: true, enum: ['png', 'jpg', 'jpeg', 'tiff', 'xtf', 'jsf'] })
  fileType: string;

  @Prop({ type: Date, default: null })
  timestamp: Date | null;

  @Prop({ type: Number, default: null })
  pingNumber: number | null;

  // Navigation metadata - either extracted from the sonar file itself, or
  // matched from an uploaded navigation.csv by timestamp/ping number.
  @Prop({ type: Number, default: null })
  latitude: number | null;

  @Prop({ type: Number, default: null })
  longitude: number | null;

  @Prop({ type: Number, default: null })
  heading: number | null; // degrees

  @Prop({ type: Number, default: null })
  depth: number | null; // metres

  @Prop({ type: Number, default: null })
  altitude: number | null;

  @Prop({ type: Number, default: null })
  heave: number | null;

  @Prop({ type: Number, default: null })
  pitch: number | null;

  @Prop({ type: Number, default: null })
  roll: number | null;

  @Prop({ enum: ['FULL', 'PARTIAL', 'UNAVAILABLE'], default: 'UNAVAILABLE' })
  motionCorrectionStatus: string;

  @Prop({ type: Number, default: null })
  range: number | null; // sonar range in metres (per side)

  @Prop({ enum: ['PORT', 'STARBOARD', 'BOTH', 'UNKNOWN'], default: 'UNKNOWN' })
  side: string;

  @Prop({ enum: ['REAL', 'ESTIMATED', 'UNAVAILABLE'], default: 'UNAVAILABLE', index: true })
  navigationSource: string; // where lat/lon/heading came from

  @Prop({ type: Object, default: {} })
  sensorMetadata: Record<string, any>;

  @Prop({ type: Number, default: null })
  imageWidth: number | null;

  @Prop({ type: Number, default: null })
  imageHeight: number | null;

  @Prop({
    enum: ['QUEUED', 'PREPROCESSING', 'INFERENCE', 'COMPLETED', 'FAILED', 'INVALID_INPUT'],
    default: 'QUEUED',
    index: true,
  })
  processingStatus: string;

  // Who uploaded this frame and whether it is trusted for the training
  // dataset without human review (spec sections 11/12). Admin uploads are
  // trusted by default; operator uploads always require admin review
  // before they can enter `training_dataset`.
  @Prop({ enum: ['ADMIN', 'OPERATOR'], default: 'ADMIN', index: true })
  uploadedByRole: string;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  uploadedByUserId: Types.ObjectId | null;

  @Prop({
    enum: ['APPROVED', 'PENDING_REVIEW', 'REJECTED', 'CORRECTED'],
    default: 'APPROVED',
    index: true,
  })
  reviewStatus: string;

  // Result of the sonar-domain ("is this actually a sonar image?") check.
  // Null until assessed.
  @Prop({ type: Object, default: null })
  domainValidity: {
    isSonarLike: boolean;
    sonarProbability: number;
    reasons: string[];
    metrics: Record<string, number>;
  } | null;

  @Prop({ type: String, default: null })
  processingError: string | null;

  @Prop({ type: String, default: null })
  preprocessedStoragePath: string | null;

  @Prop({ type: String, default: null })
  preprocessingVersion: string | null;

  @Prop({ type: Number, min: 0, max: 1, default: null })
  dropoutRatio: number | null;

  @Prop({ type: String, enum: ['GOOD', 'FAIR', 'POOR', 'UNUSABLE'], default: null })
  qualityStatus: string | null;

  @Prop({ type: Number, min: 0, max: 1, default: null })
  imageQualityScore: number | null;

  @Prop({ type: Object, default: null })
  preprocessingParameters: Record<string, any> | null;

  @Prop({ type: Date, default: null })
  processedAt: Date | null;

  createdAt: Date;
  updatedAt: Date;
}

export const SonarFrameSchema = SchemaFactory.createForClass(SonarFrame);
SonarFrameSchema.index({ surveyId: 1, createdAt: -1 });
SonarFrameSchema.index({ surveyId: 1, processingStatus: 1 });
