import { conversationRepository, ConversationRepository } from './conversation.repository.js';
import { IConversation, IMessage } from './conversation.model.js';
import { NotFoundError } from '../../shared/errors.js';
import mongoose from 'mongoose';
import { ConversationStatus, MessageRole } from '@ai-robot/shared-types';

export class ConversationService {
  constructor(private readonly repo: ConversationRepository = conversationRepository) {}

  async create(userId: string, title?: string, deviceId?: string): Promise<IConversation> {
    return this.repo.create({
      userId: new mongoose.Types.ObjectId(userId) as unknown as mongoose.Types.ObjectId,
      deviceId: deviceId ? (new mongoose.Types.ObjectId(deviceId) as unknown as mongoose.Types.ObjectId) : undefined,
      title: title || 'New Conversation',
      status: ConversationStatus.ACTIVE,
    });
  }

  async getById(id: string, userId: string): Promise<IConversation> {
    const conv = await this.repo.findById(id);
    if (!conv || conv.userId.toString() !== userId) {
      throw new NotFoundError('Conversation');
    }
    return conv;
  }

  async list(userId: string, page = 1, limit = 20) {
    return this.repo.findPaginated(
      { userId: new mongoose.Types.ObjectId(userId) },
      { page, limit, sort: { lastMessageAt: -1 } }
    );
  }

  async getMessages(conversationId: string, userId: string, limit = 50): Promise<IMessage[]> {
    await this.getById(conversationId, userId);
    return this.repo.getMessages(conversationId, limit);
  }

  async addMessage(
    conversationId: string,
    role: MessageRole,
    content: string,
    meta?: { audioId?: string; tokens?: number; latencyMs?: number; model?: string }
  ): Promise<IMessage> {
    return this.repo.addMessage({
      conversationId: new mongoose.Types.ObjectId(conversationId) as unknown as mongoose.Types.ObjectId,
      role,
      content,
      audioId: meta?.audioId ? (new mongoose.Types.ObjectId(meta.audioId) as unknown as mongoose.Types.ObjectId) : undefined,
      tokens: meta?.tokens,
      latencyMs: meta?.latencyMs,
      model: meta?.model,
    });
  }

  async delete(id: string, userId: string): Promise<void> {
    const conv = await this.getById(id, userId);
    await this.repo.deleteById(conv.id);
  }
}

export const conversationService = new ConversationService();

