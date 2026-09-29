import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type SurveyDocument = Survey & Document;

@Schema({ timestamps: true, collection: 'surveys' })
export class Survey {
  _id: Types.ObjectId;

  @Prop({ required: true, unique: true, trim: true, index: true })
  code: string; // e.g. GOA-2026-09

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ default: '' })
  description: string;

  @Prop({ type: Types.ObjectId, default: null })
  waterBodyId: Types.ObjectId | null;

  @Prop({ default: '' })
  waterBodyName: string;

  @Prop({ default: '' })
  region: string; // e.g. "Arabian Sea, India"

  @Prop({
    enum: ['PLANNED', 'ACTIVE', 'PROCESSING', 'COMPLETED', 'ARCHIVED'],
    default: 'PLANNED',
    index: true,
  })
  status: string;

  @Prop({ enum: ['LIVE', 'HISTORICAL'], default: 'LIVE', index: true })
  dataType: string; // clearly separates live operational surveys from imported historical ones

  @Prop({ type: String, default: null })
  historicalSource: string | null; // required when dataType === 'HISTORICAL'

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy: Types.ObjectId;

  @Prop({ type: [Types.ObjectId], ref: 'User', default: [] })
  assignedOperators: Types.ObjectId[];

  @Prop({ default: 0 })
  totalFrames: number;

  @Prop({ default: 0 })
  processedFrames: number;

  @Prop({ default: 0 })
  failedFrames: number;

  @Prop({ type: Date, default: null })
  surveyDate: Date | null;

  @Prop({ type: Date, default: null })
  completedAt: Date | null;

  // GeoJSON LineString of the vessel/AUV track, built incrementally from
  // navigation metadata attached to uploaded sonar frames.
  @Prop({ type: Object, default: () => ({ type: 'LineString', coordinates: [] }) })
  route: { type: string; coordinates: number[][] };

  createdAt: Date;
  updatedAt: Date;
}

export const SurveySchema = SchemaFactory.createForClass(Survey);
SurveySchema.index({ route: '2dsphere' });
SurveySchema.index({ createdAt: -1 });
