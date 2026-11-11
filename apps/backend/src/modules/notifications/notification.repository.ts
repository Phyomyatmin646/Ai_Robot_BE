import { BaseRepository } from '../../shared/base.repository.js';
import { INotification, NotificationModel } from './notification.model.js';
import mongoose from 'mongoose';
import { NotificationStatus } from '@ai-robot/shared-types';

export class NotificationRepository extends BaseRepository<INotification> {
  constructor() {
    super(NotificationModel);
  }

  async markAsRead(id: string, userId: string): Promise<INotification | null> {
    return this.model.findOneAndUpdate(
      { _id: new mongoose.Types.ObjectId(id), userId: new mongoose.Types.ObjectId(userId) },
      { $set: { status: NotificationStatus.READ, readAt: new Date() } },
      { new: true }
    ).exec();
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.model.updateMany(
      { userId: new mongoose.Types.ObjectId(userId), status: { $ne: NotificationStatus.READ } },
      { $set: { status: NotificationStatus.READ, readAt: new Date() } }
    ).exec();
  }
}

export const notificationRepository = new NotificationRepository();

