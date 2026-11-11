import mongoose, { Schema, Document } from 'mongoose';
import { DocumentStatus, DocumentType } from '@ai-robot/shared-types';

export interface IKnowledgeDocument extends Document {
  userId: mongoose.Types.ObjectId;
  collectionId?: mongoose.Types.ObjectId;
  title: string;
  sourceType: DocumentType;
  sourceUrl?: string;
  originalFileName?: string;
  content?: string;
  status: DocumentStatus;
  chunkCount: number;
  totalTokens: number;
  embeddingModel: string;
  metadata?: Record<string, unknown>;
  processedAt?: Date;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IKnowledgeChunk extends Document {
  documentId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  content: string;
  chunkIndex: number;
  tokenCount: number;
  embedding?: number[];
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

const KnowledgeDocumentSchema = new Schema<IKnowledgeDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    collectionId: { type: Schema.Types.ObjectId, ref: 'KnowledgeCollection' },
    title: { type: String, required: true, trim: true },
    sourceType: { type: String, enum: Object.values(DocumentType), default: DocumentType.TEXT },
    sourceUrl: { type: String },
    originalFileName: { type: String },
    content: { type: String },
    status: {
      type: String,
      enum: Object.values(DocumentStatus),
      default: DocumentStatus.PENDING,
      index: true,
    },
    chunkCount: { type: Number, default: 0 },
    totalTokens: { type: Number, default: 0 },
    embeddingModel: { type: String, default: 'text-embedding-004' },
    metadata: { type: Schema.Types.Mixed },
    processedAt: { type: Date },
    errorMessage: { type: String },
  },
  { timestamps: true }
);

const KnowledgeChunkSchema = new Schema<IKnowledgeChunk>(
  {
    documentId: { type: Schema.Types.ObjectId, ref: 'KnowledgeDocument', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    content: { type: String, required: true },
    chunkIndex: { type: Number, required: true },
    tokenCount: { type: Number, default: 0 },
    embedding: { type: [Number] },
    metadata: { type: Schema.Types.Mixed },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

KnowledgeChunkSchema.index({ documentId: 1, chunkIndex: 1 });
KnowledgeChunkSchema.index({ content: 'text' });

export const KnowledgeDocumentModel = mongoose.model<IKnowledgeDocument>('KnowledgeDocument', KnowledgeDocumentSchema);
export const KnowledgeChunkModel = mongoose.model<IKnowledgeChunk>('KnowledgeChunk', KnowledgeChunkSchema);

