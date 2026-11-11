import { knowledgeRepository, KnowledgeRepository } from './knowledge.repository.js';
import { IKnowledgeDocument } from './knowledge.model.js';
import { NotFoundError } from '../../shared/errors.js';
import { DocumentStatus, DocumentType } from '@ai-robot/shared-types';
import mongoose from 'mongoose';
import { config } from '../../config/index.js';
import { logger } from '../../utils/logger.js';

export class KnowledgeService {
  constructor(private readonly repo: KnowledgeRepository = knowledgeRepository) {}

  async createDocument(params: {
    userId: string;
    title: string;
    sourceType: DocumentType;
    content: string;
    sourceUrl?: string;
    originalFileName?: string;
  }): Promise<IKnowledgeDocument> {
    const doc = await this.repo.create({
      userId: new mongoose.Types.ObjectId(params.userId) as unknown as mongoose.Types.ObjectId,
      title: params.title,
      sourceType: params.sourceType,
      content: params.content,
      sourceUrl: params.sourceUrl,
      originalFileName: params.originalFileName,
      status: DocumentStatus.PROCESSING,
    });

    // Process chunking and embeddings asynchronously
    this.processDocument(doc.id, params.userId, params.content).catch((err) => {
      logger.error({ err, docId: doc.id }, 'Error processing knowledge document');
    });

    return doc;
  }

  private async processDocument(docId: string, userId: string, text: string): Promise<void> {
    try {
      // 1. Text chunking (approx 500 characters with 100 character overlap)
      const chunkSize = 500;
      const overlap = 100;
      const chunks: string[] = [];

      let start = 0;
      while (start < text.length) {
        const end = Math.min(start + chunkSize, text.length);
        chunks.push(text.slice(start, end));
        if (end === text.length) break;
        start += chunkSize - overlap;
      }

      // 2. Fetch embeddings from Python AI service or use null for text search fallback
      let embeddings: number[][] = [];
      try {
        const response = await fetch(`${config.AI_SERVICE_URL}/api/v1/embeddings/batch`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ texts: chunks }),
        });

        if (response.ok) {
          const resData = (await response.json()) as { embeddings: number[][] };
          embeddings = resData.embeddings || [];
        }
      } catch {
        logger.warn('AI Service unavailable for vector embeddings. Falling back to keyword search.');
      }

      // 3. Save chunks in database
      const chunkDocs = chunks.map((chunkText, idx) => ({
        documentId: new mongoose.Types.ObjectId(docId) as unknown as mongoose.Types.ObjectId,
        userId: new mongoose.Types.ObjectId(userId) as unknown as mongoose.Types.ObjectId,
        content: chunkText,
        chunkIndex: idx,
        tokenCount: Math.ceil(chunkText.length / 4),
        embedding: embeddings[idx] || undefined,
      }));

      await this.repo.saveChunks(chunkDocs);

      // 4. Update document status to INDEXED
      await this.repo.updateById(docId, {
        $set: {
          status: DocumentStatus.INDEXED,
          chunkCount: chunks.length,
          processedAt: new Date(),
        },
      });

      logger.info({ docId, chunks: chunks.length }, 'Knowledge document indexed successfully');
    } catch (err: unknown) {
      await this.repo.updateById(docId, {
        $set: {
          status: DocumentStatus.FAILED,
          errorMessage: err instanceof Error ? err.message : 'Unknown error during document indexing',
        },
      });
      throw err;
    }
  }

  async search(userId: string, query: string, limit = 5) {
    let queryEmbedding: number[] | null = null;

    try {
      const response = await fetch(`${config.AI_SERVICE_URL}/api/v1/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: query }),
      });

      if (response.ok) {
        const resData = (await response.json()) as { embedding: number[] };
        queryEmbedding = resData.embedding;
      }
    } catch {
      // Fallback
    }

    return this.repo.searchSimilarChunks(userId, queryEmbedding, query, limit);
  }

  async list(userId: string, page = 1, limit = 20) {
    return this.repo.findPaginated(
      { userId: new mongoose.Types.ObjectId(userId) },
      { page, limit, sort: { createdAt: -1 } }
    );
  }

  async delete(docId: string, userId: string): Promise<void> {
    const doc = await this.repo.findById(docId);
    if (!doc || doc.userId.toString() !== userId) {
      throw new NotFoundError('Knowledge document');
    }

    await this.repo.deleteChunksByDocumentId(docId);
    await this.repo.deleteById(docId);
  }
}

export const knowledgeService = new KnowledgeService();

