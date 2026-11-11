import { FastifyInstance } from 'fastify';
import { reminderController } from './reminder.controller.js';
import { authenticate } from '../../middleware/auth.js';
import { z } from 'zod';
import { validate } from '../../middleware/validate.js';
import { RecurrenceType } from '@ai-robot/shared-types';

const createReminderSchema = z.object({
  title: z.string().min(1).max(300),
  description: z.string().max(1000).optional(),
  scheduledAt: z.string().datetime({ offset: true }),
  timezone: z.string().optional(),
  recurrence: z.nativeEnum(RecurrenceType).optional(),
  recurrenceRule: z.string().optional(),
  notifyVia: z.array(z.enum(['telegram', 'websocket', 'device', 'email'])).optional(),
  notifyDeviceId: z.string().optional(),
});

export async function reminderRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', authenticate);

  fastify.post('/', {
    schema: {
      tags: ['Reminders'],
      summary: 'Schedule a new reminder with timezone support',
      security: [{ bearerAuth: [] }],
    },
    preHandler: [validate({ body: createReminderSchema })],
    handler: reminderController.create,
  });

  fastify.get('/', {
    schema: {
      tags: ['Reminders'],
      summary: 'List user reminders with pagination',
      security: [{ bearerAuth: [] }],
    },
    handler: reminderController.list,
  });

  fastify.get('/:id', {
    schema: {
      tags: ['Reminders'],
      summary: 'Get reminder details by ID',
      security: [{ bearerAuth: [] }],
    },
    handler: reminderController.getById,
  });

  fastify.patch('/:id', {
    schema: {
      tags: ['Reminders'],
      summary: 'Update reminder',
      security: [{ bearerAuth: [] }],
    },
    handler: reminderController.update,
  });

  fastify.delete('/:id', {
    schema: {
      tags: ['Reminders'],
      summary: 'Delete scheduled reminder and cancel job',
      security: [{ bearerAuth: [] }],
    },
    handler: reminderController.delete,
  });
}

