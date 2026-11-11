import { BaseRepository } from '../../shared/base.repository.js';
import { IKnowledgeDocument, IKnowledgeChunk, KnowledgeDocumentModel, KnowledgeChunkModel } from './knowledge.model.js';
import mongoose from 'mongoose';

export class KnowledgeRepository extends BaseRepository<IKnowledgeDocument> {
  constructor() {
    super(KnowledgeDocumentModel);
  }

  async saveChunks(chunks: Array<Partial<IKnowledgeChunk>>): Promise<void> {
    await KnowledgeChunkModel.insertMany(chunks);
  }

  async deleteChunksByDocumentId(documentId: string): Promise<void> {
    await KnowledgeChunkModel.deleteMany({ documentId: new mongoose.Types.ObjectId(documentId) });
  }

  /**
   * Search knowledge base using MongoDB Atlas Vector Search if vector index is configured,
   * otherwise fallback gracefully to text search
   */
  async searchSimilarChunks(
    userId: string,
    queryEmbedding: number[] | null,
    queryText: string,
    limit = 5
  ): Promise<Array<{ chunkId: string; documentId: string; content: string; score: number }>> {
    const userObjId = new mongoose.Types.ObjectId(userId);

    // If query embedding is available and vector search can be executed
    if (queryEmbedding && queryEmbedding.length > 0) {
      try {
        const pipeline = [
          {
            $vectorSearch: {
              index: 'vector_index',
              path: 'embedding',
              queryVector: queryEmbedding,
              numCandidates: limit * 10,
              limit,
              filter: { userId: userObjId },
            },
          },
          {
            $project: {
              chunkId: '$_id',
              documentId: '$documentId',
              content: '$content',
              score: { $meta: 'vectorSearchScore' },
            },
          },
        ];

        const results = await KnowledgeChunkModel.aggregate(pipeline).exec();
        if (results && results.length > 0) {
          return results;
        }
      } catch {
        // Atlas Vector Search index might not be configured on local MongoDB, fallback to text search below
      }
    }

    // Fallback: Text search
    const textResults = await KnowledgeChunkModel.find(
      { userId: userObjId, $text: { $search: queryText } },
      { score: { $meta: 'textScore' } }
    )
      .sort({ score: { $meta: 'textScore' } })
      .limit(limit)
      .exec();

    return textResults.map((doc) => ({
      chunkId: doc.id,
      documentId: doc.documentId.toString(),
      content: doc.content,
      score: (doc as unknown as { score: number }).score || 1.0,
    }));
  }
}

export const knowledgeRepository = new KnowledgeRepository();

