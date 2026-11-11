import { FastifyInstance } from 'fastify';
import { conversationController } from './conversation.controller.js';
import { authenticate } from '../../middleware/auth.js';

export async function conversationRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', authenticate);

  fastify.post('/', {
    schema: {
      tags: ['Conversations'],
      summary: 'Start a new conversation session',
      security: [{ bearerAuth: [] }],
    },
    handler: conversationController.create,
  });

  fastify.get('/', {
    schema: {
      tags: ['Conversations'],
      summary: 'List user conversations with pagination',
      security: [{ bearerAuth: [] }],
    },
    handler: conversationController.list,
  });

  fastify.get('/:id', {
    schema: {
      tags: ['Conversations'],
      summary: 'Get conversation details by ID',
      security: [{ bearerAuth: [] }],
    },
    handler: conversationController.getById,
  });

  fastify.get('/:id/messages', {
    schema: {
      tags: ['Conversations'],
      summary: 'Get message history of a conversation',
      security: [{ bearerAuth: [] }],
    },
    handler: conversationController.getMessages,
  });

  fastify.delete('/:id', {
    schema: {
      tags: ['Conversations'],
      summary: 'Delete conversation and its messages',
      security: [{ bearerAuth: [] }],
    },
    handler: conversationController.delete,
  });
}
