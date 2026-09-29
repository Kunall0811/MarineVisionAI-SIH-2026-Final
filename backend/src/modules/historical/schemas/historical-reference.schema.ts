import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type HistoricalReferenceDocument = HistoricalReference & Document;

@Schema({ timestamps: true, collection: 'historical_references' })
export class HistoricalReference {
  _id: Types.ObjectId;

  @Prop({ required: true, unique: true, index: true })
  sourceId: string;

  @Prop({ required: true, index: true })
  name: string;

  @Prop({ required: true, enum: ['SHIPWRECK', 'CONTAINER', 'MARINE_DEBRIS', 'FISHING_GEAR', 'OTHER'], index: true })
  type: string;

  @Prop({ required: true, index: true })
  eventYear: number;

  @Prop({ required: true })
  eventDate: string;

  @Prop({ required: true })
  latitude: number;

  @Prop({ required: true })
  longitude: number;

  @Prop({ type: Number, default: null })
  depthMeters: number | null;

  @Prop({ type: Number, default: null })
  quantity: number | null;

  @Prop({ type: String, default: null })
  description: string | null;

  @Prop({ required: true })
  sourceOrganization: string;

  @Prop({ required: true })
  sourceUrl: string;

  @Prop({ required: true, enum: ['EXACT', 'APPROXIMATE'] })
  coordinateAccuracy: string;

  @Prop({ required: true, enum: ['HISTORICAL_REFERENCE'] })
  dataStatus: string;

  @Prop({ type: String, default: null })
  normalizedLongitudeNote: string | null;

  @Prop({ type: [String], default: [] })
  tags: string[];

  createdAt: Date;
  updatedAt: Date;
}

export const HistoricalReferenceSchema = SchemaFactory.createForClass(HistoricalReference);
HistoricalReferenceSchema.index({ latitude: 1, longitude: 1 });
HistoricalReferenceSchema.index({ type: 1, eventYear: -1 });
