import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type DetectionDocument = Detection & Document;

export const DETECTION_CLASSES = [
  'ghost_net',
  'fishing_gear',
  'container',
  'pipe',
  'cylinder',
  'shipwreck',
  'rock',
  'marine_debris',
  'artificial_structure',
  'unknown_anomaly',
] as const;

export const COORDINATE_SOURCES = [
  'GPS_NAVIGATION_METADATA',
  'SURVEY_METADATA',
  'ESTIMATED_FROM_SONAR_GEOMETRY',
  'HISTORICAL_DATASET',
  'SIMULATED_DEMO'
] as const;

@Schema({ timestamps: true, collection: 'detections' })
export class Detection {
  _id!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Survey', required: true, index: true })
  surveyId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'SonarFrame', required: true, index: true })
  sonarFrameId!: Types.ObjectId;

  @Prop({ required: true, index: true })
  anomalyCode!: string; // e.g. ANM-024, human-readable, generated sequentially per survey

  @Prop({ required: true, enum: DETECTION_CLASSES, index: true })
  class!: string;

  @Prop({ required: true, min: 0, max: 1 })
  confidence!: number; // raw model confidence 0..1

  @Prop({ required: true, min: 0, max: 1 })
  finalConfidence!: number; // confidence after shadow/noise fusion

  @Prop({
    type: { x1: Number, y1: Number, x2: Number, y2: Number },
    required: true,
  })
  bbox!: { x1: number; y1: number; x2: number; y2: number };

  @Prop({ type: [[Number]], default: null })
  segmentationMask!: number[][] | null;

  @Prop({ type: Number, default: null })
  latitude!: number | null;

  @Prop({ type: Number, default: null })
  longitude!: number | null;

  @Prop({ type: Number, default: null })
  depth!: number | null;

  @Prop({ type: Number, default: null })
  length!: number | null; // metres

  @Prop({ type: Number, default: null })
  width!: number | null; // metres

  @Prop({ type: Number, default: null })
  height!: number | null; // metres

  @Prop({ min: 0, max: 1, default: 0.5 })
  artificialProbability!: number;

  @Prop({ min: 0, max: 1, default: 0.5 })
  naturalProbability!: number;

  @Prop({ min: 0, max: 1, default: 0 })
  shadowScore!: number;

  @Prop({ min: 0, max: 1, default: 0 })
  noiseScore!: number;

  @Prop({ enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], default: 'LOW', index: true })
  riskLevel!: string;

  @Prop({
    enum: ['PENDING_REVIEW', 'VERIFIED', 'REJECTED', 'NEEDS_REVIEW'],
    default: 'PENDING_REVIEW',
    index: true,
  })
  status!: string;

  @Prop({ type: Types.ObjectId, default: null })
  verifiedBy!: Types.ObjectId | null;

  @Prop({ type: Date, default: null })
  verifiedAt!: Date | null;

  @Prop({ default: '' })
  reviewComment!: string;

  @Prop({ required: true })
  modelVersion!: string;

  @Prop({ enum: ['REAL', 'ESTIMATED', 'UNAVAILABLE'], required: true, index: true })
  locationStatus!: string;

  @Prop({ enum: ['LIVE', 'HISTORICAL', 'SIMULATED'], default: 'LIVE', index: true })
  dataType!: string;

  @Prop({ enum: Object.values(COORDINATE_SOURCES), default: 'ESTIMATED_FROM_SONAR_GEOMETRY' })
  coordinateSource!: string;

  @Prop({ type: String, default: null })
  historicalSource!: string | null;

  @Prop({ type: String, default: null, index: true })
  targetName!: string | null;

  @Prop({ type: String, default: null })
  detailedType!: string | null;

  @Prop({ type: String, default: null })
  depthFt!: string | null;

  @Prop({ type: String, default: null })
  sonarEvidence!: string | null;

  // GeoJSON Point - ONLY populated when locationStatus === 'REAL' or 'ESTIMATED'
  @Prop({ type: Object, default: null })
  location!: { type: string; coordinates: [number, number] } | null;

  createdAt!: Date;
  updatedAt!: Date;
}

export const DetectionSchema = SchemaFactory.createForClass(Detection);
DetectionSchema.index({ location: '2dsphere' });
DetectionSchema.index({ surveyId: 1, class: 1 });
DetectionSchema.index({ surveyId: 1, status: 1 });
DetectionSchema.index({ surveyId: 1, riskLevel: 1 });
