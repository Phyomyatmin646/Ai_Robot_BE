import mongoose, { Schema, Document } from 'mongoose';
import {
  MessageRole,
  ConversationStatus,
  ToolCall,
  ToolResult,
} from '@ai-robot/shared-types';

export interface IConversation extends Document {
  userId: mongoose.Types.ObjectId;
  deviceId?: mongoose.Types.ObjectId;
  title: string;
  status: ConversationStatus;
  language: string;
  messageCount: number;
  totalTokens: number;
  lastMessageAt?: Date;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface IMessage {
  _id?: mongoose.Types.ObjectId;
  conversationId: mongoose.Types.ObjectId;
  role: MessageRole;
  content: string;
  audioId?: mongoose.Types.ObjectId;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
  tokens?: number;
  latencyMs?: number;
  model?: string;
  metadata?: Record<string, unknown>;
  createdAt?: Date;
}

const ConversationSchema = new Schema<IConversation>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    deviceId: { type: Schema.Types.ObjectId, ref: 'Device', index: true },
    title: { type: String, default: 'New Conversation', trim: true },
    status: {
      type: String,
      enum: Object.values(ConversationStatus),
      default: ConversationStatus.ACTIVE,
      index: true,
    },
    language: { type: String, default: 'en' },
    messageCount: { type: Number, default: 0 },
    totalTokens: { type: Number, default: 0 },
    lastMessageAt: { type: Date, default: Date.now },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

// Indexes
ConversationSchema.index({ userId: 1, lastMessageAt: -1 });

const MessageSchema = new Schema<IMessage>(
  {
    conversationId: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true, index: true },
    role: { type: String, enum: Object.values(MessageRole), required: true },
    content: { type: String, default: '' },
    audioId: { type: Schema.Types.ObjectId, ref: 'AudioMetadata' },
    toolCalls: { type: Schema.Types.Mixed },
    toolResults: { type: Schema.Types.Mixed },
    tokens: { type: Number },
    latencyMs: { type: Number },
    model: { type: String },
    metadata: { type: Schema.Types.Mixed },
    createdAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: false }
);

MessageSchema.index({ conversationId: 1, createdAt: 1 });

export const ConversationModel = mongoose.model<IConversation>('Conversation', ConversationSchema);
export const MessageModel = mongoose.model<IMessage>('Message', MessageSchema);

