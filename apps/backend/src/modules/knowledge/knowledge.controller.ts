import { FastifyRequest, FastifyReply } from 'fastify';
import { knowledgeService, KnowledgeService } from './knowledge.service.js';
import { successResponse, paginatedResponse } from '../../shared/response.js';
import { DocumentType } from '@ai-robot/shared-types';

export class KnowledgeController {
  constructor(private readonly service: KnowledgeService = knowledgeService) {}

  create = async (
    request: FastifyRequest<{
      Body: {
        title: string;
        content: string;
        sourceType?: DocumentType;
        sourceUrl?: string;
      };
    }>,
    reply: FastifyReply
  ) => {
    const { title, content, sourceType, sourceUrl } = request.body;
    const doc = await this.service.createDocument({
      userId: request.user!.userId,
      title,
      content,
      sourceType: sourceType || DocumentType.TEXT,
      sourceUrl,
    });
    return reply.status(201).send(successResponse(doc, 'Document accepted for indexing'));
  };

  search = async (
    request: FastifyRequest<{ Querystring: { q: string; limit?: number } }>,
    reply: FastifyReply
  ) => {
    const { q, limit } = request.query;
    const results = await this.service.search(request.user!.userId, q, Number(limit) || 5);
    return reply.send(successResponse(results));
  };

  list = async (
    request: FastifyRequest<{ Querystring: { page?: number; limit?: number } }>,
    reply: FastifyReply
  ) => {
    const { page, limit } = request.query;
    const result = await this.service.list(request.user!.userId, Number(page) || 1, Number(limit) || 20);
    return reply.send(paginatedResponse(result.data, result.pagination));
  };

  delete = async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    await this.service.delete(request.params.id, request.user!.userId);
    return reply.send(successResponse(null, 'Knowledge document deleted successfully'));
  };
}

export const knowledgeController = new KnowledgeController();

