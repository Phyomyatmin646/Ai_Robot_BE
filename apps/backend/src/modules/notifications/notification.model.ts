import mongoose, { Schema, Document } from 'mongoose';
import {
  NotificationType,
  NotificationStatus,
  NotificationChannel,
} from '@ai-robot/shared-types';

export interface INotification extends Document {
  userId: mongoose.Types.ObjectId;
  type: NotificationType;
  title: string;
  message: string;
  channel: NotificationChannel;
  status: NotificationStatus;
  data?: Record<string, unknown>;
  sentAt?: Date;
  readAt?: Date;
  error?: string;
  createdAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: Object.values(NotificationType), required: true, index: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    channel: { type: String, enum: ['telegram', 'websocket', 'device', 'email'], required: true },
    status: {
      type: String,
      enum: Object.values(NotificationStatus),
      default: NotificationStatus.PENDING,
      index: true,
    },
    data: { type: Schema.Types.Mixed },
    sentAt: { type: Date },
    readAt: { type: Date },
    error: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

NotificationSchema.index({ userId: 1, createdAt: -1 });

export const NotificationModel = mongoose.model<INotification>('Notification', NotificationSchema);
