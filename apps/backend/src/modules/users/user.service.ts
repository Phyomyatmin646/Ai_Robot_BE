import { userRepository, UserRepository } from './user.repository.js';
import { IUser } from './user.model.js';
import { NotFoundError, ConflictError } from '../../shared/errors.js';
import { hashPassword } from '../../utils/crypto.js';

export class UserService {
  constructor(private readonly userRepo: UserRepository = userRepository) {}

  async getById(id: string): Promise<IUser> {
    const user = await this.userRepo.findById(id);
    if (!user) throw new NotFoundError('User');
    return user;
  }

  async updateProfile(id: string, data: { name?: string; language?: string; timezone?: string }): Promise<IUser> {
    const user = await this.userRepo.updateById(id, { $set: data });
    if (!user) throw new NotFoundError('User');
    return user;
  }

  async linkTelegram(id: string, chatId: string): Promise<IUser> {
    const existing = await this.userRepo.findByTelegramChatId(chatId);
    if (existing && existing.id !== id) {
      throw new ConflictError('This Telegram account is already linked to another user');
    }
    const user = await this.userRepo.updateById(id, { $set: { telegramChatId: chatId } });
    if (!user) throw new NotFoundError('User');
    return user;
  }

  async unlinkTelegram(id: string): Promise<IUser> {
    const user = await this.userRepo.updateById(id, { $unset: { telegramChatId: 1 } });
    if (!user) throw new NotFoundError('User');
    return user;
  }
}

export const userService = new UserService();
