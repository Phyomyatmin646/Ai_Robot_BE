import { FastifyInstance } from 'fastify';
import { knowledgeController } from './knowledge.controller.js';
import { authenticate } from '../../middleware/auth.js';
import { z } from 'zod';
import { validate } from '../../middleware/validate.js';
import { DocumentType } from '@ai-robot/shared-types';

const createDocSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(10, 'Content must have at least 10 characters'),
  sourceType: z.nativeEnum(DocumentType).optional(),
  sourceUrl: z.string().url().optional(),
});

export async function knowledgeRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', authenticate);

  fastify.post('/', {
    schema: {
      tags: ['Knowledge'],
      summary: 'Upload text or document to RAG knowledge base',
      security: [{ bearerAuth: [] }],
    },
    preHandler: [validate({ body: createDocSchema })],
    handler: knowledgeController.create,
  });

  fastify.get('/search', {
    schema: {
      tags: ['Knowledge'],
      summary: 'Semantic vector search across personal knowledge base',
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        required: ['q'],
        properties: {
          q: { type: 'string' },
          limit: { type: 'number', default: 5 },
        },
      },
    },
    handler: knowledgeController.search,
  });

  fastify.get('/', {
    schema: {
      tags: ['Knowledge'],
      summary: 'List indexed documents with pagination',
      security: [{ bearerAuth: [] }],
    },
    handler: knowledgeController.list,
  });

  fastify.delete('/:id', {
    schema: {
      tags: ['Knowledge'],
      summary: 'Delete knowledge document and associated chunks',
      security: [{ bearerAuth: [] }],
    },
    handler: knowledgeController.delete,
  });
}

