import { FastifyInstance } from 'fastify';
import { mcpController } from './mcp.controller.js';
import { authenticate } from '../../middleware/auth.js';
import { z } from 'zod';
import { validate } from '../../middleware/validate.js';

const executeToolSchema = z.object({
  toolName: z.string().min(1),
  arguments: z.record(z.unknown()).default({}),
  conversationId: z.string().optional(),
});

export async function mcpRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', authenticate);

  fastify.get('/tools', {
    schema: {
      tags: ['MCP'],
      summary: 'List all registered and enabled MCP tools and schemas',
      security: [{ bearerAuth: [] }],
    },
    handler: mcpController.listTools,
  });

  fastify.post('/execute', {
    schema: {
      tags: ['MCP'],
      summary: 'Execute authorized MCP tool with validation and audit logging',
      security: [{ bearerAuth: [] }],
    },
    preHandler: [validate({ body: executeToolSchema })],
    handler: mcpController.execute,
  });

  fastify.get('/logs', {
    schema: {
      tags: ['MCP'],
      summary: 'Get execution history of MCP tools',
      security: [{ bearerAuth: [] }],
    },
    handler: mcpController.getLogs,
  });
}
