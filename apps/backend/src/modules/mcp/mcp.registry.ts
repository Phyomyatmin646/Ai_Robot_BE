import { MCPTool, ToolPermission } from '@ai-robot/shared-types';
import { todoService } from '../todo/todo.service.js';
import { reminderService } from '../reminders/reminder.service.js';
import { knowledgeService } from '../knowledge/knowledge.service.js';
import { deviceService } from '../devices/device.service.js';
import { settingsService } from '../settings/settings.service.js';
import { conversationService } from '../conversations/conversation.service.js';
import { config } from '../../config/index.js';

export interface ToolHandlerContext {
  userId: string;
  conversationId?: string;
  deviceId?: string;
}

export type ToolHandler = (args: Record<string, unknown>, ctx: ToolHandlerContext) => Promise<unknown>;

interface RegisteredTool {
  definition: MCPTool;
  handler: ToolHandler;
}

class ToolRegistry {
  private tools = new Map<string, RegisteredTool>();

  register(tool: MCPTool, handler: ToolHandler): void {
    this.tools.set(tool.name, { definition: tool, handler });
  }

  get(name: string): RegisteredTool | undefined {
    return this.tools.get(name);
  }

  getAllDefinitions(): MCPTool[] {
    return Array.from(this.tools.values()).map((t) => t.definition);
  }
}

export const toolRegistry = new ToolRegistry();

// -------------------------------------------------------------
// Register Standard MCP Tools
// -------------------------------------------------------------

// 1. get_current_time
toolRegistry.register(
  {
    name: 'get_current_time',
    description: 'Get the current date and time in the user timezone.',
    inputSchema: {
      type: 'object',
      properties: {
        timezone: { type: 'string', description: 'Timezone identifier (e.g. Asia/Yangon, UTC)' },
      },
    },
    permissions: [ToolPermission.READ],
    requiresConfirmation: false,
    isEnabled: true,
    category: 'system',
    version: '1.0.0',
  },
  async (args) => {
    const tz = (args.timezone as string) || config.DEFAULT_TIMEZONE;
    const now = new Date();
    return {
      iso: now.toISOString(),
      formatted: now.toLocaleString('en-US', { timeZone: tz }),
      timezone: tz,
    };
  }
);

// 2. get_weather
toolRegistry.register(
  {
    name: 'get_weather',
    description: 'Get current weather conditions for a specified location.',
    inputSchema: {
      type: 'object',
      properties: {
        location: { type: 'string', description: 'City name or coordinates' },
      },
      required: ['location'],
    },
    permissions: [ToolPermission.READ],
    requiresConfirmation: false,
    isEnabled: true,
    category: 'information',
    version: '1.0.0',
  },
  async (args) => {
    const location = args.location as string;
    // Standard mock weather response
    return {
      location,
      condition: 'Sunny',
      temperatureC: 28,
      temperatureF: 82.4,
      humidity: '65%',
      windSpeed: '12 km/h',
    };
  }
);

// 3. create_todo
toolRegistry.register(
  {
    name: 'create_todo',
    description: 'Create a new task or todo item for the user.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Title of the task' },
        description: { type: 'string', description: 'Optional details' },
        dueDate: { type: 'string', description: 'Due date in ISO format' },
      },
      required: ['title'],
    },
    permissions: [ToolPermission.WRITE],
    requiresConfirmation: false,
    isEnabled: true,
    category: 'productivity',
    version: '1.0.0',
  },
  async (args, ctx) => {
    return todoService.create(
      ctx.userId,
      {
        title: args.title as string,
        description: args.description as string,
        dueDate: args.dueDate as string,
      },
      'ai'
    );
  }
);

// 4. get_todos
toolRegistry.register(
  {
    name: 'get_todos',
    description: 'Retrieve pending or active tasks for the user.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max items to return' },
      },
    },
    permissions: [ToolPermission.READ],
    requiresConfirmation: false,
    isEnabled: true,
    category: 'productivity',
    version: '1.0.0',
  },
  async (args, ctx) => {
    const res = await todoService.list(ctx.userId, { limit: (args.limit as number) || 10 });
    return res.data;
  }
);

// 5. create_reminder
toolRegistry.register(
  {
    name: 'create_reminder',
    description: 'Schedule a time-based reminder.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'What to remind the user about' },
        scheduledAt: { type: 'string', description: 'Scheduled ISO date-time string' },
      },
      required: ['title', 'scheduledAt'],
    },
    permissions: [ToolPermission.WRITE, ToolPermission.NOTIFICATION],
    requiresConfirmation: false,
    isEnabled: true,
    category: 'productivity',
    version: '1.0.0',
  },
  async (args, ctx) => {
    return reminderService.create(
      ctx.userId,
      {
        title: args.title as string,
        scheduledAt: args.scheduledAt as string,
        notifyDeviceId: ctx.deviceId,
      },
      'ai'
    );
  }
);

// 6. search_knowledge
toolRegistry.register(
  {
    name: 'search_knowledge',
    description: 'Search user knowledge base for facts, notes, documents, or custom context.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'The search query or question' },
      },
      required: ['query'],
    },
    permissions: [ToolPermission.READ],
    requiresConfirmation: false,
    isEnabled: true,
    category: 'knowledge',
    version: '1.0.0',
  },
  async (args, ctx) => {
    return knowledgeService.search(ctx.userId, args.query as string, 4);
  }
);

// 7. get_device_status
toolRegistry.register(
  {
    name: 'get_device_status',
    description: 'Check the robot hardware, battery, volume, and connection status.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    permissions: [ToolPermission.READ, ToolPermission.DEVICE_CONTROL],
    requiresConfirmation: false,
    isEnabled: true,
    category: 'device',
    version: '1.0.0',
  },
  async (_args, ctx) => {
    if (!ctx.deviceId) return { message: 'No connected robot found for this session.' };
    const device = await deviceService.getById(ctx.deviceId, ctx.userId);
    return {
      name: device.name,
      status: device.status,
      batteryLevel: '85%',
      volume: device.config.volumeLevel,
      brightness: device.config.brightnessLevel,
      firmware: device.firmwareVersion,
    };
  }
);

// 8. update_device_settings
toolRegistry.register(
  {
    name: 'update_device_settings',
    description: 'Adjust robot hardware settings such as volume (0-100) or screen brightness.',
    inputSchema: {
      type: 'object',
      properties: {
        volume: { type: 'number', description: 'Volume level from 0 to 100' },
        brightness: { type: 'number', description: 'Brightness level from 0 to 100' },
      },
    },
    permissions: [ToolPermission.WRITE, ToolPermission.DEVICE_CONTROL],
    requiresConfirmation: false,
    isEnabled: true,
    category: 'device',
    version: '1.0.0',
  },
  async (args, ctx) => {
    if (!ctx.deviceId) return { message: 'No connected robot found.' };
    const updateObj: Record<string, unknown> = {};
    if (args.volume !== undefined) updateObj['sound.masterVolume'] = args.volume;
    if (args.brightness !== undefined) updateObj['display.brightness'] = args.brightness;

    await settingsService.updateDeviceSettings(ctx.deviceId, updateObj);
    return { success: true, message: 'Settings updated successfully' };
  }
);

// 9. get_conversation_history
toolRegistry.register(
  {
    name: 'get_conversation_history',
    description: 'Retrieve previous messages from the current conversation.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Number of past messages' },
      },
    },
    permissions: [ToolPermission.READ],
    requiresConfirmation: false,
    isEnabled: true,
    category: 'system',
    version: '1.0.0',
  },
  async (args, ctx) => {
    if (!ctx.conversationId) return [];
    return conversationService.getMessages(ctx.conversationId, ctx.userId, (args.limit as number) || 10);
  }
);
