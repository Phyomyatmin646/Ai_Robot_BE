import { FastifyInstance } from 'fastify';
import { analyticsController } from './analytics.controller.js';
import { authenticate } from '../../middleware/auth.js';

export async function analyticsRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', authenticate);

  fastify.get('/stats', {
    schema: {
      tags: ['Analytics'],
      summary: 'Get dashboard telemetry and platform analytics overview',
      security: [{ bearerAuth: [] }],
    },
    handler: analyticsController.getStats,
  });
}

