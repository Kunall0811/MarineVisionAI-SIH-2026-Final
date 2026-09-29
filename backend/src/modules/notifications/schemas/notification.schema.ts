import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type NotificationDocument = Notification & Document;

export const NOTIFICATION_TYPES = [
  'HIGH_RISK_ANOMALY',
  'REPORT_GENERATED',
  'SURVEY_COMPLETED',
  'PROCESSING_FAILURE',
  'ANOMALY_VERIFIED',
  'FRIDAY_SUGGESTION',
  'SYSTEM',
  'DATASET_SUBMITTED',
  'DATASET_REVIEWED',
  'COORDINATE_UPDATED',
] as const;

@Schema({ timestamps: true, collection: 'notifications' })
export class Notification {
  _id: Types.ObjectId;

  // null recipientId => broadcast to all ADMIN users (see NotificationsService.createForAdmins)
  @Prop({ type: Types.ObjectId, ref: 'User', default: null, index: true })
  recipientId: Types.ObjectId | null;

  @Prop({ required: true, enum: NOTIFICATION_TYPES, index: true })
  type: string;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  message: string;

  @Prop({ enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'INFO'], default: 'INFO' })
  severity: string;

  @Prop({ type: Object, default: {} })
  metadata: Record<string, any>;

  @Prop({ default: false, index: true })
  isRead: boolean;

  createdAt: Date;
  updatedAt: Date;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);
NotificationSchema.index({ recipientId: 1, isRead: 1, createdAt: -1 });
