import mongoose, { Schema, Document } from 'mongoose';

export interface IRfidLearningLog extends Document {
  deviceId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  cardUid?: string;
  schemaVersion: string;
  cardType: string;
  title: string;
  category: string;
  language: string;
  aiResponseText: string;
  hasAudio: boolean;
  audioId?: mongoose.Types.ObjectId;
  durationMs: number;
  createdAt: Date;
  updatedAt: Date;
}

const RfidLearningLogSchema = new Schema<IRfidLearningLog>(
  {
    deviceId: { type: Schema.Types.ObjectId, ref: 'Device', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    cardUid: { type: String, trim: true, index: true },
    schemaVersion: { type: String, default: '1.0' },
    cardType: { type: String, default: 'educational' },
    title: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true, index: true },
    language: { type: String, default: 'my' },
    aiResponseText: { type: String, required: true },
    hasAudio: { type: Boolean, default: false },
    audioId: { type: Schema.Types.ObjectId, ref: 'AudioMetadata' },
    durationMs: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Compound indexes for history queries
RfidLearningLogSchema.index({ userId: 1, createdAt: -1 });
RfidLearningLogSchema.index({ deviceId: 1, createdAt: -1 });

export const RfidLearningLogModel = mongoose.model<IRfidLearningLog>(
  'RfidLearningLog',
  RfidLearningLogSchema
);
