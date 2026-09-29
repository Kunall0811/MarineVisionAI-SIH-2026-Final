import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type DatasetImageDocument = DatasetImage & Document;

@Schema({ timestamps: true, collection: 'ai_dataset_images' })
export class DatasetImage {
  _id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Dataset', required: true, index: true })
  datasetId: Types.ObjectId;

  @Prop({ required: true })
  fileName: string;

  @Prop({ required: true })
  storagePath: string;

  @Prop({ required: true, index: true })
  label: string; // must be one of Dataset.classes - validated at upload time

  @Prop({ enum: ['TRAIN', 'VAL', 'TEST', 'UNASSIGNED'], default: 'UNASSIGNED', index: true })
  split: string;

  @Prop({ type: Number, default: null })
  width: number | null;

  @Prop({ type: Number, default: null })
  height: number | null;

  @Prop({ default: false })
  isAugmented: boolean; // true for synthetically generated augmentation copies

  createdAt: Date;
  updatedAt: Date;
}

export const DatasetImageSchema = SchemaFactory.createForClass(DatasetImage);
DatasetImageSchema.index({ datasetId: 1, split: 1 });
