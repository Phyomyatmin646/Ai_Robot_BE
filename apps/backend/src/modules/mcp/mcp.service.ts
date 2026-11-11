import { toolRegistry, ToolHandlerContext } from './mcp.registry.js';
import { ToolExecutionLogModel } from './mcp.model.js';
import { ToolExecutionRequest, ToolExecutionResult } from '@ai-robot/shared-types';
import mongoose from 'mongoose';
import { logger } from '../../utils/logger.js';

export class MCPService {
  async executeTool(request: ToolExecutionRequest): Promise<ToolExecutionResult> {
    const startTime = Date.now();
    const tool = toolRegistry.get(request.toolName);

    if (!tool || !tool.definition.isEnabled) {
      return {
        success: false,
        error: `Tool '${request.toolName}' is not registered or is disabled`,
        executionTimeMs: 0,
      };
    }

    const ctx: ToolHandlerContext = {
      userId: request.userId,
      conversationId: request.conversationId,
    };

    try {
      const result = await tool.handler(request.arguments, ctx);
      const executionTimeMs = Date.now() - startTime;

      // Log execution for audit trail
      await ToolExecutionLogModel.create({
        userId: new mongoose.Types.ObjectId(request.userId),
        conversationId: request.conversationId
          ? new mongoose.Types.ObjectId(request.conversationId)
          : undefined,
        toolName: request.toolName,
        arguments: request.arguments,
        result,
        executionTimeMs,
        status: 'success',
      });

      return {
        success: true,
        result,
        executionTimeMs,
      };
    } catch (err: unknown) {
      const executionTimeMs = Date.now() - startTime;
      const errorMessage = err instanceof Error ? err.message : 'Unknown tool execution error';

      logger.error({ err, toolName: request.toolName }, 'MCP Tool execution error');

      await ToolExecutionLogModel.create({
        userId: new mongoose.Types.ObjectId(request.userId),
        conversationId: request.conversationId
          ? new mongoose.Types.ObjectId(request.conversationId)
          : undefined,
        toolName: request.toolName,
        arguments: request.arguments,
        error: errorMessage,
        executionTimeMs,
        status: 'error',
      });

      return {
        success: false,
        error: errorMessage,
        executionTimeMs,
      };
    }
  }

  getRegisteredTools() {
    return toolRegistry.getAllDefinitions();
  }

  async getExecutionLogs(userId: string, limit = 50) {
    return ToolExecutionLogModel.find({ userId: new mongoose.Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();
  }
}

export const mcpService = new MCPService();

