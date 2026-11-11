import { FastifyInstance } from 'fastify';
import { userController } from './user.controller.js';
import { authenticate } from '../../middleware/auth.js';
import { z } from 'zod';
import { validate } from '../../middleware/validate.js';

const updateProfileSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  language: z.string().min(2).max(10).optional(),
  timezone: z.string().optional(),
});

const linkTelegramSchema = z.object({
  chatId: z.string().min(1),
});

export async function userRoutes(fastify: FastifyInstance): Promise<void> {
  // All user routes require authentication
  fastify.addHook('preHandler', authenticate);

  fastify.get('/profile', {
    schema: {
      tags: ['Users'],
      summary: 'Get current user profile',
      security: [{ bearerAuth: [] }],
    },
    handler: userController.getProfile,
  });

  fastify.patch('/profile', {
    schema: {
      tags: ['Users'],
      summary: 'Update current user profile',
      security: [{ bearerAuth: [] }],
    },
    preHandler: [validate({ body: updateProfileSchema })],
    handler: userController.updateProfile,
  });

  fastify.post('/telegram/link', {
    schema: {
      tags: ['Users'],
      summary: 'Link Telegram Chat ID to user account',
      security: [{ bearerAuth: [] }],
    },
    preHandler: [validate({ body: linkTelegramSchema })],
    handler: userController.linkTelegram,
  });

  fastify.post('/telegram/unlink', {
    schema: {
      tags: ['Users'],
      summary: 'Unlink Telegram Chat ID from user account',
      security: [{ bearerAuth: [] }],
    },
    handler: userController.unlinkTelegram,
  });
}
