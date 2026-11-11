import { BaseRepository } from '../../shared/base.repository.js';
import { IUser, UserModel } from './user.model.js';

export class UserRepository extends BaseRepository<IUser> {
  constructor() {
    super(UserModel);
  }

  async findByEmail(email: string, includeSecret = false): Promise<IUser | null> {
    const query = this.model.findOne({ email: email.toLowerCase() });
    if (includeSecret) {
      query.select('+passwordHash +refreshTokenHash');
    }
    return query.exec();
  }

  async updateRefreshToken(userId: string, tokenHash: string | null): Promise<void> {
    await this.model.findByIdAndUpdate(userId, { refreshTokenHash: tokenHash }).exec();
  }

  async updateLastLogin(userId: string): Promise<void> {
    await this.model.findByIdAndUpdate(userId, { lastLoginAt: new Date() }).exec();
  }

  async findByTelegramChatId(chatId: string): Promise<IUser | null> {
    return this.model.findOne({ telegramChatId: chatId }).exec();
  }
}

export const userRepository = new UserRepository();

