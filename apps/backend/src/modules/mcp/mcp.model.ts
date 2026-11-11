import mongoose, { Schema, Document } from 'mongoose';

export interface IToolExecutionLog extends Document {
  userId: mongoose.Types.ObjectId;
  conversationId?: mongoose.Types.ObjectId;
  deviceId?: mongoose.Types.ObjectId;
  toolName: string;
  arguments: Record<string, unknown>;
  result?: unknown;
  error?: string;
  executionTimeMs: number;
  status: 'success' | 'error' | 'denied' | 'timeout';
  createdAt: Date;
}

const ToolExecutionLogSchema = new Schema<IToolExecutionLog>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    conversationId: { type: Schema.Types.ObjectId, ref: 'Conversation', index: true },
    deviceId: { type: Schema.Types.ObjectId, ref: 'Device', index: true },
    toolName: { type: String, required: true, index: true },
    arguments: { type: Schema.Types.Mixed },
    result: { type: Schema.Types.Mixed },
    error: { type: String },
    executionTimeMs: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['success', 'error', 'denied', 'timeout'],
      default: 'success',
      index: true,
    },
    createdAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: false }
);

export const ToolExecutionLogModel = mongoose.model<IToolExecutionLog>(
  'ToolExecutionLog',
  ToolExecutionLogSchema
);

