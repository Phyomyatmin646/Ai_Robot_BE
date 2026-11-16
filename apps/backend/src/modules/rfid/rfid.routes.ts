import { FastifyInstance } from 'fastify';
import { rfidController } from './rfid.controller.js';
import { authenticate } from '../../middleware/auth.js';

export async function rfidRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', authenticate);

  fastify.get('/history', {
    schema: {
      tags: ['RFID Learning'],
      summary: 'List user RFID educational interaction history',
      security: [{ bearerAuth: [] }],
    },
    handler: rfidController.listHistory,
  });

  fastify.get('/history/:id', {
    schema: {
      tags: ['RFID Learning'],
      summary: 'Get RFID educational interaction details by ID',
      security: [{ bearerAuth: [] }],
    },
    handler: rfidController.getHistoryById,
  });

  fastify.post('/simulate-scan', {
    schema: {
      tags: ['RFID Learning'],
      summary: 'Simulate an RFID card scan for testing or dashboard triggers',
      security: [{ bearerAuth: [] }],
    },
    handler: rfidController.simulateScan,
  });
}
