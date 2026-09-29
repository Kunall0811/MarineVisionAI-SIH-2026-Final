import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type WaterBodyDocument = WaterBody & Document;

@Schema({ timestamps: true, collection: 'water_bodies' })
export class WaterBody {
  _id: Types.ObjectId;

  @Prop({ required: true, trim: true, index: true })
  name: string;

  @Prop({ required: true, enum: ['OCEAN', 'SEA', 'LAKE', 'RIVER'], index: true })
  type: string;

  @Prop({ default: '' })
  region: string;

  // Simplified reference boundary (Polygon/MultiPolygon) - see seed script
  // for source/attribution. NOT survey-grade hydrography.
  @Prop({ type: Object, required: true })
  geometry: { type: string; coordinates: any };

  @Prop({ required: true })
  source: string; // e.g. "Simplified reference boundary - Natural Earth derived"

  createdAt: Date;
  updatedAt: Date;
}

export const WaterBodySchema = SchemaFactory.createForClass(WaterBody);
WaterBodySchema.index({ geometry: '2dsphere' });
