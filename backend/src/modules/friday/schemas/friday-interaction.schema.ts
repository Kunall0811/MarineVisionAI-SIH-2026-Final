import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type FridayInteractionDocument = FridayInteraction & Document;

/**
 * One row per FRIDAY voice/text command. This is the raw signal the
 * self-learning/personalization layer (learning.service.ts) aggregates
 * over - frequency counts and intent-transition counts computed from real
 * logged interactions, never invented.
 */
@Schema({ timestamps: true, collection: 'friday_interactions' })
export class FridayInteraction {
  _id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ required: true })
  transcript: string;

  @Prop({ required: true, index: true })
  intent: string;

  @Prop({ type: Object, default: {} })
  parameters: Record<string, any>;

  @Prop({ enum: ['PENDING_CONFIRMATION', 'EXECUTED', 'DENIED', 'FAILED', 'CANCELLED'], default: 'EXECUTED', index: true })
  status: string;

  @Prop({ default: false })
  requiredConfirmation: boolean;

  @Prop({ required: true })
  spokenResponse: string;

  @Prop({ type: Object, default: {} })
  resultData: Record<string, any>;

  createdAt: Date;
  updatedAt: Date;
}

export const FridayInteractionSchema = SchemaFactory.createForClass(FridayInteraction);
FridayInteractionSchema.index({ userId: 1, createdAt: -1 });
