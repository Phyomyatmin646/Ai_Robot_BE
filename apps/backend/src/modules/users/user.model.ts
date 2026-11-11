import mongoose, { Schema, Document } from 'mongoose';
import { UserRole } from '@ai-robot/shared-types';

export interface IUser extends Document {
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  isActive: boolean;
  language: string;
  timezone: string;
  telegramChatId?: string;
  lastLoginAt?: Date;
  refreshTokenHash?: string;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
    },
    passwordHash: { type: String, required: true },
    role: {
      type: String,
      enum: Object.values(UserRole),
      default: UserRole.USER,
      index: true,
    },
    isActive: { type: Boolean, default: true, index: true },
    language: { type: String, default: 'en' },
    timezone: { type: String, default: 'Asia/Yangon' },
    telegramChatId: { type: String, sparse: true, index: true },
    lastLoginAt: { type: Date },
    refreshTokenHash: { type: String, select: false },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => {
        delete (ret as Record<string, unknown>).passwordHash;
        delete (ret as Record<string, unknown>).refreshTokenHash;
        delete (ret as Record<string, unknown>).__v;
        ret.id = ret._id;
        delete ret._id;
        return ret;
      },
    },
  }
);

// Indexes
UserSchema.index({ email: 1, isActive: 1 });

export const UserModel = mongoose.model<IUser>('User', UserSchema);

