export enum ReminderStatus {
  ACTIVE = 'active',
  TRIGGERED = 'triggered',
  SNOOZED = 'snoozed',
  CANCELLED = 'cancelled',
  COMPLETED = 'completed',
}

export enum RecurrenceType {
  NONE = 'none',
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  YEARLY = 'yearly',
  CUSTOM = 'custom',
}

export type NotificationChannel = 'telegram' | 'websocket' | 'device' | 'email';

export interface Reminder {
  id: string;
  userId: string;
  title: string;
  description?: string;
  scheduledAt: Date;
  timezone: string;
  status: ReminderStatus;
  recurrence: RecurrenceType;
  recurrenceRule?: string;
  notifyVia: NotificationChannel[];
  notifyDeviceId?: string;
  lastTriggeredAt?: Date;
  nextTriggerAt?: Date;
  snoozeUntil?: Date;
  createdBy: 'user' | 'ai' | 'system';
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateReminderRequest {
  title: string;
  description?: string;
  scheduledAt: string;
  timezone?: string;
  recurrence?: RecurrenceType;
  recurrenceRule?: string;
  notifyVia?: NotificationChannel[];
  notifyDeviceId?: string;
}

export interface UpdateReminderRequest {
  title?: string;
  description?: string;
  scheduledAt?: string;
  timezone?: string;
  status?: ReminderStatus;
  recurrence?: RecurrenceType;
  recurrenceRule?: string;
  notifyVia?: NotificationChannel[];
  notifyDeviceId?: string;
}

