import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type UserDocument = User & Document;

@Schema({ timestamps: true, collection: 'users' })
export class User {
  _id: Types.ObjectId;

  @Prop({ required: true, trim: true })
  fullName: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true, index: true })
  email: string;

  @Prop({ required: true, select: false })
  passwordHash: string;

  @Prop({ required: true, enum: ['ADMIN', 'OPERATOR'], default: 'OPERATOR', index: true })
  role: 'ADMIN' | 'OPERATOR';

  @Prop({ default: false })
  isEmailVerified: boolean;

  @Prop({ type: String, default: null, select: false })
  emailVerificationTokenHash: string | null;

  @Prop({ type: Date, default: null })
  emailVerificationExpires: Date | null;

  @Prop({ type: String, default: null, select: false })
  passwordResetTokenHash: string | null;

  @Prop({ type: Date, default: null })
  passwordResetExpires: Date | null;

  @Prop({ type: String, default: null, select: false })
  refreshTokenHash: string | null;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({
    type: {
      canUpload: { type: Boolean, default: true },
      canProcess: { type: Boolean, default: true },
      canVerifyDetections: { type: Boolean, default: true },
      canGenerateReports: { type: Boolean, default: true },
    },
    default: () => ({
      canUpload: true,
      canProcess: true,
      canVerifyDetections: true,
      canGenerateReports: true,
    }),
  })
  operatorPermissions: {
    canUpload: boolean;
    canProcess: boolean;
    canVerifyDetections: boolean;
    canGenerateReports: boolean;
  };

  @Prop({ type: Date, default: null })
  lastLoginAt: Date | null;

  createdAt: Date;
  updatedAt: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
