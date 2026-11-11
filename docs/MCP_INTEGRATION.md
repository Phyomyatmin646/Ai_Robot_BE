# Model Context Protocol (MCP) Integration Guide

## 1. Overview

The platform implements an extensible Model Context Protocol (MCP) server that empowers the AI to safely query and manipulate backend resources.

---

## 2. Standard Registered Tools

| Tool Name | Category | Permissions | Description |
|---|---|---|---|
| `get_current_time` | System | READ | Returns current time formatted in user timezone. |
| `get_weather` | Info | READ | Fetches weather data for a given city. |
| `create_todo` | Productivity | WRITE | Creates a new todo item in MongoDB. |
| `get_todos` | Productivity | READ | Fetches pending tasks. |
| `create_reminder` | Productivity | WRITE, NOTIFICATION | Schedules a BullMQ job with Telegram and WebSocket alerts. |
| `search_knowledge` | Knowledge | READ | Performs semantic search on the user's RAG knowledge base. |
| `get_device_status` | Device | READ, DEVICE_CONTROL | Checks ESP32 battery, signal, and connection status. |
| `update_device_settings` | Device | WRITE, DEVICE_CONTROL | Sends hardware volume and brightness commands to the robot. |
| `get_conversation_history` | System | READ | Retrieves previous turns from the conversation. |

---

## 3. Adding a New MCP Tool

New tools can be registered without modifying the AI core by registering them in `apps/backend/src/modules/mcp/mcp.registry.ts`:

```typescript
toolRegistry.register(
  {
    name: 'custom_tool_name',
    description: 'Explain what the tool does clearly for the LLM.',
    inputSchema: {
      type: 'object',
      properties: {
        param1: { type: 'string', description: 'Parameter description' }
      },
      required: ['param1']
    },
    permissions: [ToolPermission.READ],
    requiresConfirmation: false,
    isEnabled: true,
    category: 'custom',
    version: '1.0.0'
  },
  async (args, ctx) => {
    // Implement tool business logic
    return { success: true, result: 'data' };
  }
);
```

