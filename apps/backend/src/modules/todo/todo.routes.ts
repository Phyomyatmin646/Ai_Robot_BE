import { FastifyInstance } from 'fastify';
import { todoController } from './todo.controller.js';
import { authenticate } from '../../middleware/auth.js';
import { z } from 'zod';
import { validate } from '../../middleware/validate.js';
import { TodoPriority } from '@ai-robot/shared-types';

const createTodoSchema = z.object({
  title: z.string().min(1).max(300),
  description: z.string().max(2000).optional(),
  priority: z.nativeEnum(TodoPriority).optional(),
  category: z.string().optional(),
  dueDate: z.string().datetime({ offset: true }).optional(),
  tags: z.array(z.string()).optional(),
});

export async function todoRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', authenticate);

  fastify.post('/', {
    schema: {
      tags: ['Todo'],
      summary: 'Create a new todo item',
      security: [{ bearerAuth: [] }],
    },
    preHandler: [validate({ body: createTodoSchema })],
    handler: todoController.create,
  });

  fastify.get('/', {
    schema: {
      tags: ['Todo'],
      summary: 'List todo items with filtering, search and pagination',
      security: [{ bearerAuth: [] }],
    },
    handler: todoController.list,
  });

  fastify.get('/:id', {
    schema: {
      tags: ['Todo'],
      summary: 'Get todo item details by ID',
      security: [{ bearerAuth: [] }],
    },
    handler: todoController.getById,
  });

  fastify.patch('/:id', {
    schema: {
      tags: ['Todo'],
      summary: 'Update todo item',
      security: [{ bearerAuth: [] }],
    },
    handler: todoController.update,
  });

  fastify.post('/:id/complete', {
    schema: {
      tags: ['Todo'],
      summary: 'Mark todo item as completed',
      security: [{ bearerAuth: [] }],
    },
    handler: todoController.complete,
  });

  fastify.delete('/:id', {
    schema: {
      tags: ['Todo'],
      summary: 'Delete todo item',
      security: [{ bearerAuth: [] }],
    },
    handler: todoController.delete,
  });
}

