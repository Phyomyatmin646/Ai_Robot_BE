import mongoose, { Schema, Document } from 'mongoose';
import { AudioType, AudioFormat } from '@ai-robot/shared-types';

export interface IAudioMetadata extends Document {
  userId: mongoose.Types.ObjectId;
  deviceId?: mongoose.Types.ObjectId;
  conversationId?: mongoose.Types.ObjectId;
  fileName: string;
  mimeType: string;
  codec: string;
  format: AudioFormat;
  sampleRate: number;
  channels: number;
  bitDepth: number;
  duration: number;
  fileSize: number;
  audioType: AudioType;
  storageRef: string; // GridFS ObjectId as string
  storageType: 'gridfs' | 's3';
  createdAt: Date;
  updatedAt: Date;
}

const AudioMetadataSchema = new Schema<IAudioMetadata>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    deviceId: { type: Schema.Types.ObjectId, ref: 'Device', index: true },
    conversationId: { type: Schema.Types.ObjectId, ref: 'Conversation', index: true },
    fileName: { type: String, required: true },
    mimeType: { type: String, default: 'audio/wav' },
    codec: { type: String, default: 'pcm_16bit' },
    format: { type: String, enum: Object.values(AudioFormat), default: AudioFormat.WAV },
    sampleRate: { type: Number, default: 16000 },
    channels: { type: Number, default: 1 },
    bitDepth: { type: Number, default: 16 },
    duration: { type: Number, default: 0 },
    fileSize: { type: Number, default: 0 },
    audioType: { type: String, enum: Object.values(AudioType), default: AudioType.USER_INPUT, index: true },
    storageRef: { type: String, required: true },
    storageType: { type: String, enum: ['gridfs', 's3'], default: 'gridfs' },
  },
  { timestamps: true }
);

AudioMetadataSchema.index({ userId: 1, createdAt: -1 });

export const AudioMetadataModel = mongoose.model<IAudioMetadata>('AudioMetadata', AudioMetadataSchema);

