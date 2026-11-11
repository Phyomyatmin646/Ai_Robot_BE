import { BaseRepository } from '../../shared/base.repository.js';
import { IConversation, IMessage, ConversationModel, MessageModel } from './conversation.model.js';
import mongoose from 'mongoose';

export class ConversationRepository extends BaseRepository<IConversation> {
  constructor() {
    super(ConversationModel);
  }

  async getMessages(conversationId: string, limit = 50, beforeDate?: Date): Promise<IMessage[]> {
    const filter: Record<string, unknown> = {
      conversationId: new mongoose.Types.ObjectId(conversationId),
    };
    if (beforeDate) {
      filter.createdAt = { $lt: beforeDate };
    }

    return MessageModel.find(filter).sort({ createdAt: 1 }).limit(limit).exec();
  }

  async addMessage(data: Partial<IMessage>): Promise<IMessage> {
    const msg = await MessageModel.create(data);
    await this.model.findByIdAndUpdate(data.conversationId, {
      $inc: { messageCount: 1, totalTokens: data.tokens || 0 },
      $set: { lastMessageAt: new Date() },
    });
    return msg;
  }
}

export const conversationRepository = new ConversationRepository();
