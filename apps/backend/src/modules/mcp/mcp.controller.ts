import { FastifyRequest, FastifyReply } from 'fastify';
import { mcpService, MCPService } from './mcp.service.js';
import { successResponse } from '../../shared/response.js';

export class MCPController {
  constructor(private readonly service: MCPService = mcpService) {}

  listTools = async (_request: FastifyRequest, reply: FastifyReply) => {
    const tools = this.service.getRegisteredTools();
    return reply.send(successResponse(tools));
  };

  execute = async (
    request: FastifyRequest<{
      Body: {
        toolName: string;
        arguments: Record<string, unknown>;
        conversationId?: string;
      };
    }>,
    reply: FastifyReply
  ) => {
    const { toolName, arguments: args, conversationId } = request.body;
    const result = await this.service.executeTool({
      toolName,
      arguments: args,
      userId: request.user!.userId,
      conversationId: conversationId || '',
    });
    return reply.send(successResponse(result));
  };

  getLogs = async (
    request: FastifyRequest<{ Querystring: { limit?: number } }>,
    reply: FastifyReply
  ) => {
    const logs = await this.service.getExecutionLogs(
      request.user!.userId,
      Number(request.query.limit) || 50
    );
    return reply.send(successResponse(logs));
  };
}

export const mcpController = new MCPController();

