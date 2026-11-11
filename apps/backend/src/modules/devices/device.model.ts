import mongoose, { Schema, Document } from 'mongoose';
import {
  DeviceType,
  DeviceStatus,
  ConnectionType,
  DeviceConfig,
  DeviceCapabilities,
} from '@ai-robot/shared-types';

export interface IDevice extends Document {
  userId: mongoose.Types.ObjectId;
  name: string;
  deviceType: DeviceType;
  status: DeviceStatus;
  apiKeyHash: string;
  firmwareVersion: string;
  hardwareVersion: string;
  macAddress: string;
  ipAddress?: string;
  lastSeen?: Date;
  isRegistered: boolean;
  config: DeviceConfig;
  capabilities: DeviceCapabilities;
  createdAt: Date;
  updatedAt: Date;
}

export interface IDeviceSession extends Document {
  deviceId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  connectionType: ConnectionType;
  startedAt: Date;
  endedAt?: Date;
  isActive: boolean;
  ipAddress?: string;
  socketId?: string;
  disconnectReason?: string;
}

const DeviceConfigSubSchema = new Schema(
  {
    wifiSSID: { type: String },
    audioSampleRate: { type: Number, default: 16000 },
    audioChannels: { type: Number, default: 1 },
    audioBitDepth: { type: Number, default: 16 },
    audioChunkSize: { type: Number, default: 4096 },
    audioCodec: { type: String, default: 'pcm_16bit' },
    volumeLevel: { type: Number, default: 80, min: 0, max: 100 },
    brightnessLevel: { type: Number, default: 80, min: 0, max: 100 },
    ledEnabled: { type: Boolean, default: true },
    sleepTimeout: { type: Number, default: 300 },
    heartbeatInterval: { type: Number, default: 15 },
  },
  { _id: false }
);

const DeviceCapabilitiesSubSchema = new Schema(
  {
    hasMicrophone: { type: Boolean, default: true },
    hasSpeaker: { type: Boolean, default: true },
    hasDisplay: { type: Boolean, default: true },
    hasTouchSensor: { type: Boolean, default: true },
    hasLED: { type: Boolean, default: true },
    hasVolumeButtons: { type: Boolean, default: true },
    maxSampleRate: { type: Number, default: 48000 },
    supportedCodecs: { type: [String], default: ['pcm_16bit', 'wav'] },
  },
  { _id: false }
);

const DeviceSchema = new Schema<IDevice>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true, default: 'ESP32 AI Robot' },
    deviceType: {
      type: String,
      enum: Object.values(DeviceType),
      default: DeviceType.ESP32_S3,
    },
    status: {
      type: String,
      enum: Object.values(DeviceStatus),
      default: DeviceStatus.OFFLINE,
      index: true,
    },
    apiKeyHash: { type: String, required: true, select: false },
    firmwareVersion: { type: String, default: '1.0.0' },
    hardwareVersion: { type: String, default: 'ESP32-S3-WROOM-1' },
    macAddress: { type: String, required: true, unique: true, uppercase: true, trim: true },
    ipAddress: { type: String },
    lastSeen: { type: Date },
    isRegistered: { type: Boolean, default: true },
    config: { type: DeviceConfigSubSchema, default: () => ({}) },
    capabilities: { type: DeviceCapabilitiesSubSchema, default: () => ({}) },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => {
        delete (ret as Record<string, unknown>).apiKeyHash;
        delete (ret as Record<string, unknown>).__v;
        ret.id = ret._id;
        delete ret._id;
        return ret;
      },
    },
  }
);

// Compound indexes
DeviceSchema.index({ userId: 1, status: 1 });
DeviceSchema.index({ macAddress: 1 });

const DeviceSessionSchema = new Schema<IDeviceSession>(
  {
    deviceId: { type: Schema.Types.ObjectId, ref: 'Device', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    connectionType: {
      type: String,
      enum: Object.values(ConnectionType),
      default: ConnectionType.WEBSOCKET,
    },
    startedAt: { type: Date, default: Date.now },
    endedAt: { type: Date },
    isActive: { type: Boolean, default: true, index: true },
    ipAddress: { type: String },
    socketId: { type: String },
    disconnectReason: { type: String },
  },
  { timestamps: true }
);

export const DeviceModel = mongoose.model<IDevice>('Device', DeviceSchema);
export const DeviceSessionModel = mongoose.model<IDeviceSession>('DeviceSession', DeviceSessionSchema);
