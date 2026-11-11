import mongoose, { Schema, Document } from 'mongoose';
import {
  UserSettings,
  DeviceSettings,
} from '@ai-robot/shared-types';

export interface IUserSettings extends Document, Omit<UserSettings, 'userId'> {
  userId: mongoose.Types.ObjectId;
}

export interface IDeviceSettings extends Document, Omit<DeviceSettings, 'deviceId' | 'userId'> {
  deviceId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
}

const UserSettingsSchema = new Schema<IUserSettings>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    language: { type: String, default: 'en' },
    timezone: { type: String, default: 'Asia/Yangon' },
    notifications: {
      telegramEnabled: { type: Boolean, default: false },
      telegramChatId: { type: String },
      emailEnabled: { type: Boolean, default: true },
      reminderNotifications: { type: Boolean, default: true },
      todoNotifications: { type: Boolean, default: true },
      deviceAlerts: { type: Boolean, default: true },
      dailySummary: { type: Boolean, default: true },
      quietHoursEnabled: { type: Boolean, default: false },
      quietHoursStart: { type: String, default: '22:00' },
      quietHoursEnd: { type: String, default: '07:00' },
    },
    ai: {
      fastModel: { type: String, default: 'gemini-2.0-flash' },
      thinkingModel: { type: String, default: 'gemini-2.0-pro' },
      voiceModel: { type: String, default: 'gemini-2.0-flash-live' },
      personality: { type: String, default: 'Helpful and concise robot companion.' },
      systemPrompt: { type: String },
      responseLanguage: { type: String, default: 'en' },
      ragEnabled: { type: Boolean, default: true },
      mcpEnabled: { type: Boolean, default: true },
      thinkingLevel: { type: String, enum: ['fast', 'balanced', 'deep'], default: 'fast' },
      temperature: { type: Number, default: 0.7, min: 0, max: 2 },
      maxResponseTokens: { type: Number, default: 800 },
    },
  },
  { timestamps: true }
);

const DeviceSettingsSchema = new Schema<IDeviceSettings>(
  {
    deviceId: { type: Schema.Types.ObjectId, ref: 'Device', required: true, unique: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    voice: {
      provider: { type: String, default: 'gemini' },
      model: { type: String, default: 'gemini-2.0-flash-live' },
      voiceId: { type: String, default: 'Puck' },
      language: { type: String, default: 'en' },
      speed: { type: Number, default: 1.0, min: 0.5, max: 2.0 },
      volume: { type: Number, default: 80, min: 0, max: 100 },
      responseMode: { type: String, enum: ['auto', 'push_to_talk', 'wake_word'], default: 'auto' },
      wakeWord: { type: String, default: 'Hey Robot' },
    },
    sound: {
      masterVolume: { type: Number, default: 80, min: 0, max: 100 },
      isMuted: { type: Boolean, default: false },
      outputVolume: { type: Number, default: 80, min: 0, max: 100 },
      notificationVolume: { type: Number, default: 70, min: 0, max: 100 },
      feedbackSoundsEnabled: { type: Boolean, default: true },
    },
    display: {
      brightness: { type: Number, default: 80, min: 0, max: 100 },
      isOn: { type: Boolean, default: true },
      sleepTimeoutSeconds: { type: Number, default: 300 },
      theme: { type: String, enum: ['light', 'dark', 'auto'], default: 'dark' },
    },
    device: {
      name: { type: String, default: 'ESP32 AI Robot' },
      wifiSSID: { type: String },
      firmwareAutoUpdate: { type: Boolean, default: false },
      heartbeatIntervalSeconds: { type: Number, default: 15 },
      logLevel: { type: String, enum: ['debug', 'info', 'warn', 'error'], default: 'info' },
    },
  },
  { timestamps: true }
);

export const UserSettingsModel = mongoose.model<IUserSettings>('UserSettings', UserSettingsSchema);
export const DeviceSettingsModel = mongoose.model<IDeviceSettings>('DeviceSettings', DeviceSettingsSchema);

