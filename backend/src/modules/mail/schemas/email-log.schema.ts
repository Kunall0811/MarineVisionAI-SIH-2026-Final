import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type EmailLogDocument = EmailLog & Document;

@Schema({ timestamps: true, collection: 'email_logs' })
export class EmailLog {
  _id: Types.ObjectId;

  @Prop({ required: true })
  to: string; // comma separated for multi-recipient sends

  @Prop({ required: true })
  subject: string;

  @Prop({ required: true, index: true })
  triggerEvent: string; // e.g. HIGH_RISK_ANOMALY, MANUAL, VERIFICATION_EMAIL

  @Prop({ enum: ['SENT', 'LOGGED_ONLY', 'FAILED'], required: true, index: true })
  status: string;

  @Prop({ default: '' })
  messageId: string;

  @Prop({ default: '' })
  errorMessage: string;

  @Prop({ type: Object, default: {} })
  metadata: Record<string, any>;

  createdAt: Date;
  updatedAt: Date;
}

export const EmailLogSchema = SchemaFactory.createForClass(EmailLog);
EmailLogSchema.index({ createdAt: -1 });
