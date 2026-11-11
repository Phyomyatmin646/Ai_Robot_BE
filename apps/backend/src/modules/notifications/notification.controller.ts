import { FastifyRequest, FastifyReply } from 'fastify';
import { notificationService, NotificationService } from './notification.service.js';
import { successResponse, paginatedResponse } from '../../shared/response.js';

export class NotificationController {
  constructor(private readonly service: NotificationService = notificationService) {}

  list = async (
    request: FastifyRequest<{ Querystring: { page?: number; limit?: number } }>,
    reply: FastifyReply
  ) => {
    const { page, limit } = request.query;
    const result = await this.service.list(request.user!.userId, Number(page) || 1, Number(limit) || 20);
    return reply.send(paginatedResponse(result.data, result.pagination));
  };

  markAsRead = async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const notification = await this.service.markAsRead(request.params.id, request.user!.userId);
    return reply.send(successResponse(notification, 'Notification marked as read'));
  };

  markAllAsRead = async (request: FastifyRequest, reply: FastifyReply) => {
    await this.service.markAllAsRead(request.user!.userId);
    return reply.send(successResponse(null, 'All notifications marked as read'));
  };
}

export const notificationController = new NotificationController();
