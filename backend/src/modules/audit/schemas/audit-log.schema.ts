import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type AuditLogDocument = AuditLog & Document;

/**
 * Every authorized/destructive action in the system writes one of these.
 * This is the single source of truth for "who did what, when" - required
 * by both the Admin Audit Logs page and FRIDAY's confirmation flow for
 * destructive/high-impact voice commands.
 */
@Schema({ timestamps: true, collection: 'audit_logs' })
export class AuditLog {
  _id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ required: true })
  userEmail: string;

  @Prop({ required: true, enum: ['ADMIN', 'OPERATOR'] })
  userRole: string;

  @Prop({ required: true, index: true })
  action: string; // e.g. "DETECTION_VERIFIED", "USER_ROLE_CHANGED", "FRIDAY_COMMAND_EXECUTED"

  @Prop({ required: true })
  category: string; // e.g. "DETECTIONS", "SURVEYS", "USERS", "FRIDAY", "TRAINING", "REPORTS", "MAIL"

  @Prop({ default: '' })
  targetType: string; // e.g. "Detection", "Survey", "User"

  @Prop({ type: String, default: null })
  targetId: string | null;

  @Prop({ type: Object, default: {} })
  metadata: Record<string, any>;

  @Prop({ default: '' })
  ipAddress: string;

  @Prop({ enum: ['SUCCESS', 'FAILED', 'DENIED'], default: 'SUCCESS' })
  outcome: string;

  createdAt: Date;
  updatedAt: Date;
}

export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);
AuditLogSchema.index({ createdAt: -1 });
AuditLogSchema.index({ category: 1, createdAt: -1 });
