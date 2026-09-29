import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ReportDocument = Report & Document;

@Schema({ timestamps: true, collection: 'reports' })
export class Report {
  _id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Survey', required: true, index: true })
  surveyId: Types.ObjectId;

  @Prop({ required: true })
  surveyCode: string;

  @Prop({ required: true, enum: ['PDF', 'CSV', 'JSON', 'GEOJSON'], index: true })
  format: string;

  @Prop({ required: true })
  fileName: string;

  @Prop({ required: true })
  storagePath: string;

  @Prop({ required: true, default: 0 })
  fileSizeBytes: number;

  @Prop({ required: true, default: 0 })
  detectionCount: number;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  generatedBy: Types.ObjectId;

  @Prop({ type: [String], default: [] })
  emailedTo: string[];

  createdAt: Date;
  updatedAt: Date;
}

export const ReportSchema = SchemaFactory.createForClass(Report);
ReportSchema.index({ createdAt: -1 });
