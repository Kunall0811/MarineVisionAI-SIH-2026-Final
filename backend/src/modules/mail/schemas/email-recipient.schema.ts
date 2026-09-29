import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type EmailRecipientDocument = EmailRecipient & Document;

export const ALERT_EVENT_TYPES = [
  'HIGH_RISK_ANOMALY',
  'REPORT_GENERATED',
  'SURVEY_COMPLETED',
  'PROCESSING_FAILURE',
  'ANOMALY_VERIFIED',
] as const;

/** A configured "authority" recipient who receives automated alert emails. */
@Schema({ timestamps: true, collection: 'email_recipients' })
export class EmailRecipient {
  _id: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, trim: true, lowercase: true })
  email: string;

  @Prop({ default: '' })
  organization: string;

  @Prop({ type: [String], enum: ALERT_EVENT_TYPES, default: ALERT_EVENT_TYPES })
  subscribedEvents: string[];

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  addedBy: Types.ObjectId;

  createdAt: Date;
  updatedAt: Date;
}

export const EmailRecipientSchema = SchemaFactory.createForClass(EmailRecipient);
