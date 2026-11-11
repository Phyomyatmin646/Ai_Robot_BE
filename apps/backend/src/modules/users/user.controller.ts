import { FastifyRequest, FastifyReply } from 'fastify';
import { userService, UserService } from './user.service.js';
import { successResponse } from '../../shared/response.js';

export class UserController {
  constructor(private readonly service: UserService = userService) {}

  getProfile = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = await this.service.getById(request.user!.userId);
    return reply.send(successResponse(user));
  };

  updateProfile = async (
    request: FastifyRequest<{ Body: { name?: string; language?: string; timezone?: string } }>,
    reply: FastifyReply
  ) => {
    const user = await this.service.updateProfile(request.user!.userId, request.body);
    return reply.send(successResponse(user, 'Profile updated successfully'));
  };

  linkTelegram = async (
    request: FastifyRequest<{ Body: { chatId: string } }>,
    reply: FastifyReply
  ) => {
    const user = await this.service.linkTelegram(request.user!.userId, request.body.chatId);
    return reply.send(successResponse(user, 'Telegram account linked successfully'));
  };

  unlinkTelegram = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = await this.service.unlinkTelegram(request.user!.userId);
    return reply.send(successResponse(user, 'Telegram account unlinked successfully'));
  };
}

export const userController = new UserController();

