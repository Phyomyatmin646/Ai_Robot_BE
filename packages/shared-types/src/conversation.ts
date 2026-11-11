export enum MessageRole {
  USER = 'user',
  ASSISTANT = 'assistant',
  SYSTEM = 'system',
  TOOL = 'tool',
}

export enum ConversationStatus {
  ACTIVE = 'active',
  COMPLETED = 'completed',
  ARCHIVED = 'archived',
}

export interface Conversation {
  id: string;
  userId: string;
  deviceId?: string;
  title: string;
  status: ConversationStatus;
  language: string;
  messageCount: number;
  totalTokens: number;
  lastMessageAt?: Date;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface Message {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  audioId?: string;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
  tokens?: number;
  latencyMs?: number;
  model?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  toolCallId: string;
  name: string;
  result: unknown;
  error?: string;
}

export interface ConversationContext {
  conversationId: string;
  systemPrompt: string;
  messages: Message[];
  maxTokens: number;
  temperature: number;
}

