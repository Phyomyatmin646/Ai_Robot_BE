export interface MCPTool {
  name: string;
  description: string;
  inputSchema: ToolInputSchema;
  outputSchema?: ToolOutputSchema;
  permissions: ToolPermission[];
  requiresConfirmation: boolean;
  isEnabled: boolean;
  category: string;
  version: string;
}

export interface ToolInputSchema {
  type: 'object';
  properties: Record<string, ToolSchemaProperty>;
  required?: string[];
}

export interface ToolOutputSchema {
  type: string;
  properties?: Record<string, ToolSchemaProperty>;
  description?: string;
}

export interface ToolSchemaProperty {
  type: string;
  description: string;
  enum?: string[];
  default?: unknown;
  items?: ToolSchemaProperty;
  properties?: Record<string, ToolSchemaProperty>;
  required?: string[];
}

export enum ToolPermission {
  READ = 'read',
  WRITE = 'write',
  DELETE = 'delete',
  ADMIN = 'admin',
  DEVICE_CONTROL = 'device_control',
  NOTIFICATION = 'notification',
}

export interface ToolExecutionRequest {
  toolName: string;
  arguments: Record<string, unknown>;
  userId: string;
  conversationId: string;
  requiresConfirmation?: boolean;
}

export interface ToolExecutionResult {
  success: boolean;
  result?: unknown;
  error?: string;
  executionTimeMs: number;
}

export interface ToolExecutionLog {
  id: string;
  userId: string;
  conversationId: string;
  toolName: string;
  arguments: Record<string, unknown>;
  result?: unknown;
  error?: string;
  executionTimeMs: number;
  status: 'success' | 'error' | 'denied' | 'timeout';
  createdAt: Date;
}

