import type { NotificationChannel } from './reminder.js';

export enum NotificationType {
  REMINDER = 'reminder',
  TODO_DUE = 'todo_due',
  DEVICE_OFFLINE = 'device_offline',
  DEVICE_ONLINE = 'device_online',
  SYSTEM_ALERT = 'system_alert',
  AI_ALERT = 'ai_alert',
  DAILY_SUMMARY = 'daily_summary',
  CUSTOM = 'custom',
}

export enum NotificationStatus {
  PENDING = 'pending',
  SENT = 'sent',
  DELIVERED = 'delivered',
  READ = 'read',
  FAILED = 'failed',
}

export interface Notification {
  id: string;
  userId: string;
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

export interface NotificationPreferences {
  userId: string;
  telegram: {
    enabled: boolean;
    chatId?: string;
    categories: NotificationType[];
  };
  websocket: {
    enabled: boolean;
    categories: NotificationType[];
  };
  device: {
    enabled: boolean;
    categories: NotificationType[];
  };
  quietHours: {
    enabled: boolean;
    startTime: string;
    endTime: string;
    timezone: string;
  };
}

