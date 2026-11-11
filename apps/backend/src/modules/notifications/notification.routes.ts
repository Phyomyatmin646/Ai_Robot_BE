import { FastifyInstance } from 'fastify';
import { notificationController } from './notification.controller.js';
import { authenticate } from '../../middleware/auth.js';

export async function notificationRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', authenticate);

  fastify.get('/', {
    schema: {
      tags: ['Notifications'],
      summary: 'List user notifications with pagination',
      security: [{ bearerAuth: [] }],
    },
    handler: notificationController.list,
  });

  fastify.post('/:id/read', {
    schema: {
      tags: ['Notifications'],
      summary: 'Mark single notification as read',
      security: [{ bearerAuth: [] }],
    },
    handler: notificationController.markAsRead,
  });

  fastify.post('/read-all', {
    schema: {
      tags: ['Notifications'],
      summary: 'Mark all user notifications as read',
      security: [{ bearerAuth: [] }],
    },
    handler: notificationController.markAllAsRead,
  });
}
