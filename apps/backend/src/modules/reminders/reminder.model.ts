import mongoose, { Schema, Document } from 'mongoose';
import {
  ReminderStatus,
  RecurrenceType,
  NotificationChannel,
} from '@ai-robot/shared-types';

export interface IReminder extends Document {
  userId: mongoose.Types.ObjectId;
  title: string;
  description?: string;
  scheduledAt: Date;
  timezone: string;
  status: ReminderStatus;
  recurrence: RecurrenceType;
  recurrenceRule?: string;
  notifyVia: NotificationChannel[];
  notifyDeviceId?: mongoose.Types.ObjectId;
  lastTriggeredAt?: Date;
  nextTriggerAt?: Date;
  snoozeUntil?: Date;
  createdBy: 'user' | 'ai' | 'system';
  jobId?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const ReminderSchema = new Schema<IReminder>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true, minlength: 1, maxlength: 300 },
    description: { type: String, trim: true, maxlength: 1000 },
    scheduledAt: { type: Date, required: true, index: true },
    timezone: { type: String, default: 'Asia/Yangon' },
    status: {
      type: String,
      enum: Object.values(ReminderStatus),
      default: ReminderStatus.ACTIVE,
      index: true,
    },
    recurrence: {
      type: String,
      enum: Object.values(RecurrenceType),
      default: RecurrenceType.NONE,
    },
    recurrenceRule: { type: String },
    notifyVia: {
      type: [String],
      enum: ['telegram', 'websocket', 'device', 'email'],
      default: ['websocket', 'telegram'],
    },
    notifyDeviceId: { type: Schema.Types.ObjectId, ref: 'Device' },
    lastTriggeredAt: { type: Date },
    nextTriggerAt: { type: Date, index: true },
    snoozeUntil: { type: Date },
    createdBy: { type: String, enum: ['user', 'ai', 'system'], default: 'user' },
    jobId: { type: String },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

ReminderSchema.index({ userId: 1, status: 1, scheduledAt: 1 });

export const ReminderModel = mongoose.model<IReminder>('Reminder', ReminderSchema);
