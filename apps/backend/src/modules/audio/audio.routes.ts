import { FastifyInstance } from 'fastify';
import { audioController } from './audio.controller.js';
import { authenticate } from '../../middleware/auth.js';

export async function audioRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', authenticate);

  fastify.get('/', {
    schema: {
      tags: ['Audio'],
      summary: 'List audio recordings with filters and pagination',
      security: [{ bearerAuth: [] }],
    },
    handler: audioController.list,
  });

  fastify.get('/:id', {
    schema: {
      tags: ['Audio'],
      summary: 'Get audio metadata by ID',
      security: [{ bearerAuth: [] }],
    },
    handler: audioController.getById,
  });

  fastify.get('/:id/stream', {
    schema: {
      tags: ['Audio'],
      summary: 'Stream audio file with HTTP Range support for seeking',
      security: [{ bearerAuth: [] }],
    },
    handler: audioController.streamAudio,
  });

  fastify.delete('/:id', {
    schema: {
      tags: ['Audio'],
      summary: 'Delete audio recording from GridFS and database',
      security: [{ bearerAuth: [] }],
    },
    handler: audioController.delete,
  });
}

