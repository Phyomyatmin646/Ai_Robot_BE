import { describe, it, expect } from 'vitest';
import { toolRegistry } from '../src/modules/mcp/mcp.registry.js';

describe('MCP Tool System', () => {
  it('should have standard system tools registered', () => {
    const timeTool = toolRegistry.get('get_current_time');
    expect(timeTool).toBeDefined();
    expect(timeTool?.definition.name).toBe('get_current_time');

    const weatherTool = toolRegistry.get('get_weather');
    expect(weatherTool).toBeDefined();

    const todoTool = toolRegistry.get('create_todo');
    expect(todoTool).toBeDefined();

    const reminderTool = toolRegistry.get('create_reminder');
    expect(reminderTool).toBeDefined();
  });

  it('should execute get_current_time accurately', async () => {
    const timeTool = toolRegistry.get('get_current_time');
    const result = (await timeTool?.handler({ timezone: 'Asia/Yangon' }, { userId: '123' })) as {
      timezone: string;
      formatted: string;
    };

    expect(result.timezone).toBe('Asia/Yangon');
    expect(result.formatted).toBeDefined();
  });
});

