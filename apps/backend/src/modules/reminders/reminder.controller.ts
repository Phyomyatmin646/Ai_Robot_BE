import { FastifyRequest, FastifyReply } from 'fastify';
import { reminderService, ReminderService } from './reminder.service.js';
import { successResponse, paginatedResponse } from '../../shared/response.js';
import { CreateReminderRequest, UpdateReminderRequest } from '@ai-robot/shared-types';

export class ReminderController {
  constructor(private readonly service: ReminderService = reminderService) {}

  create = async (request: FastifyRequest<{ Body: CreateReminderRequest }>, reply: FastifyReply) => {
    const reminder = await this.service.create(request.user!.userId, request.body);
    return reply.status(201).send(successResponse(reminder, 'Reminder scheduled successfully'));
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
    const reminder = await this.service.getById(request.params.id, request.user!.userId);
    return reply.send(successResponse(reminder));
  };

  update = async (
    request: FastifyRequest<{ Params: { id: string }; Body: UpdateReminderRequest }>,
    reply: FastifyReply
  ) => {
    const reminder = await this.service.update(request.params.id, request.user!.userId, request.body);
    return reply.send(successResponse(reminder, 'Reminder updated successfully'));
  };

  delete = async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    await this.service.delete(request.params.id, request.user!.userId);
    return reply.send(successResponse(null, 'Reminder deleted successfully'));
  };
}

export const reminderController = new ReminderController();

