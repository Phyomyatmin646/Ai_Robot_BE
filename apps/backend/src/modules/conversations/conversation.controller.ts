import { FastifyRequest, FastifyReply } from 'fastify';
import { conversationService, ConversationService } from './conversation.service.js';
import { successResponse, paginatedResponse } from '../../shared/response.js';

export class ConversationController {
  constructor(private readonly service: ConversationService = conversationService) {}

  create = async (
    request: FastifyRequest<{ Body: { title?: string; deviceId?: string } }>,
    reply: FastifyReply
  ) => {
    const conv = await this.service.create(request.user!.userId, request.body?.title, request.body?.deviceId);
    return reply.status(201).send(successResponse(conv, 'Conversation created'));
  };

  list = async (
    request: FastifyRequest<{ Querystring: { page?: number; limit?: number } }>,
    reply: FastifyReply
  ) => {
    const { page, limit } = request.query;
    const result = await this.service.list(request.user!.userId, Number(page) || 1, Number(limit) || 20);
    return reply.send(paginatedResponse(result.data, result.pagination));
  };

  getById = async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const conv = await this.service.getById(request.params.id, request.user!.userId);
    return reply.send(successResponse(conv));
  };

  getMessages = async (
    request: FastifyRequest<{ Params: { id: string }; Querystring: { limit?: number } }>,
    reply: FastifyReply
  ) => {
    const messages = await this.service.getMessages(
      request.params.id,
      request.user!.userId,
      Number(request.query.limit) || 50
    );
    return reply.send(successResponse(messages));
  };

  delete = async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    await this.service.delete(request.params.id, request.user!.userId);
    return reply.send(successResponse(null, 'Conversation deleted'));
  };
}

export const conversationController = new ConversationController();

