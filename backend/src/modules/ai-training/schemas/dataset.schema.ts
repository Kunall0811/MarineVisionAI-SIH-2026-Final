import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type DatasetDocument = Dataset & Document;

@Schema({ timestamps: true, collection: 'ai_datasets' })
export class Dataset {
  _id: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ default: '' })
  description: string;

  @Prop({ type: [String], required: true })
  classes: string[]; // label set this dataset is annotated for

  @Prop({ enum: ['DRAFT', 'SUBMITTED_FOR_REVIEW', 'APPROVED', 'REJECTED', 'SPLIT', 'READY'], default: 'DRAFT' })
  status: string;

  @Prop({ default: 0 })
  imageCount: number;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy: Types.ObjectId;

  @Prop({ type: String, default: null })
  submittedBy: string | null;

  @Prop({ type: Date, default: null })
  submittedAt: Date | null;

  @Prop({ type: String, default: null })
  reviewDecision: string | null;

  @Prop({ type: String, default: null })
  reviewNotes: string | null;

  @Prop({ type: String, default: null })
  reviewedBy: string | null;

  @Prop({ type: Date, default: null })
  reviewedAt: Date | null;

  createdAt: Date;
  updatedAt: Date;
}

export const DatasetSchema = SchemaFactory.createForClass(Dataset);
