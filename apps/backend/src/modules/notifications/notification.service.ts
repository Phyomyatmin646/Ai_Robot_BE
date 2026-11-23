import { notificationRepository, NotificationRepository } from './notification.repository.js';
import { INotification } from './notification.model.js';
import { telegramService, TelegramService } from '../telegram/telegram.service.js';
import { dashboardBroadcast } from '../../websocket/dashboard.gateway.js';
import { userRepository } from '../users/user.repository.js';
import { settingsRepository } from '../settings/settings.repository.js';
import { NotificationType, NotificationStatus, NotificationChannel } from '@ai-robot/shared-types';
import mongoose from 'mongoose';

export class NotificationService {
  constructor(
    private readonly repo: NotificationRepository = notificationRepository,
    private readonly telegram: TelegramService = telegramService
  ) {}

  async send(params: {
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    channels?: NotificationChannel[];
    data?: Record<string, unknown>;
  }): Promise<INotification[]> {
    const user = await userRepository.findById(params.userId);
    if (!user) return [];

    const userSettings = await settingsRepository.getUserSettings(params.userId);
    const notificationsConfig = userSettings?.notifications;

    const channelsToSend = params.channels || ['websocket', 'telegram'];
    const created: INotification[] = [];

    for (const channel of channelsToSend) {
      if (channel === 'telegram') {
        // Linking a chat in the dashboard opts in. Keep support for legacy settings-only links.
        const chatId = user.telegramChatId ||
          (notificationsConfig?.telegramEnabled ? notificationsConfig.telegramChatId : undefined);

        if (chatId) {
          const sent = await this.telegram.sendMessage(
            chatId,
            `🔔 ${params.title}\n\n${params.message}`,
            null
          );
          const doc = await this.repo.create({
            userId: new mongoose.Types.ObjectId(params.userId) as unknown as mongoose.Types.ObjectId,
            type: params.type,
            title: params.title,
            message: params.message,
            channel: 'telegram',
            status: sent ? NotificationStatus.DELIVERED : NotificationStatus.FAILED,
            sentAt: sent ? new Date() : undefined,
            data: params.data,
          });
          created.push(doc);
        }
      }

      if (channel === 'websocket') {
        dashboardBroadcast.emitNotification(params.userId, {
          type: params.type,
          title: params.title,
          message: params.message,
          timestamp: Date.now(),
          data: params.data,
        });

        const doc = await this.repo.create({
          userId: new mongoose.Types.ObjectId(params.userId) as unknown as mongoose.Types.ObjectId,
          type: params.type,
          title: params.title,
          message: params.message,
          channel: 'websocket',
          status: NotificationStatus.DELIVERED,
          sentAt: new Date(),
          data: params.data,
        });
        created.push(doc);
      }
    }

    return created;
  }

  async list(userId: string, page = 1, limit = 20) {
    return this.repo.findPaginated(
      { userId: new mongoose.Types.ObjectId(userId) },
      { page, limit, sort: { createdAt: -1 } }
    );
  }

  async markAsRead(id: string, userId: string): Promise<INotification | null> {
    return this.repo.markAsRead(id, userId);
  }

  async markAllAsRead(userId: string): Promise<void> {
    return this.repo.markAllAsRead(userId);
  }
}

export const notificationService = new NotificationService();

