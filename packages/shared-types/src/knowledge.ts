export enum DocumentStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  INDEXED = 'indexed',
  FAILED = 'failed',
  DELETED = 'deleted',
}

export enum DocumentType {
  TEXT = 'text',
  PDF = 'pdf',
  DOCX = 'docx',
  TXT = 'txt',
  URL = 'url',
  MARKDOWN = 'markdown',
}

export interface KnowledgeDocument {
  id: string;
  userId: string;
  collectionId?: string;
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

export interface KnowledgeChunk {
  id: string;
  documentId: string;
  userId: string;
  content: string;
  chunkIndex: number;
  tokenCount: number;
  embedding?: number[];
  metadata?: {
    page?: number;
    section?: string;
    source?: string;
    [key: string]: unknown;
  };
  createdAt: Date;
}

export interface KnowledgeCollection {
  id: string;
  userId: string;
  name: string;
  description?: string;
  documentCount: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface EmbeddingMeta {
  id: string;
  provider: string;
  model: string;
  dimension: number;
  totalEmbeddings: number;
  lastUpdated: Date;
}

export interface SearchResult {
  chunkId: string;
  documentId: string;
  content: string;
  score: number;
  metadata?: Record<string, unknown>;
}

export interface SearchQuery {
  query: string;
  userId: string;
  collectionId?: string;
  limit?: number;
  minScore?: number;
  filters?: Record<string, unknown>;
}

