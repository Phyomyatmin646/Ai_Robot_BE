import { FastifyInstance } from 'fastify';
import { voiceController } from './voice.controller.js';
import { authenticate } from '../../middleware/auth.js';

export async function voiceRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/config', {
    schema: {
      tags: ['Voice'],
      summary: 'Get voice engine configuration and streaming parameters',
      security: [{ bearerAuth: [] }],
    },
    preHandler: [authenticate],
    handler: voiceController.getConfig,
  });
}
