import { reminderRepository, ReminderRepository } from './reminder.repository.js';
import { IReminder } from './reminder.model.js';
import { NotFoundError } from '../../shared/errors.js';
import { scheduleReminderJob, removeReminderJob } from '../../jobs/queue.js';
import {
  CreateReminderRequest,
  UpdateReminderRequest,
  ReminderStatus,
  RecurrenceType,
} from '@ai-robot/shared-types';
import mongoose from 'mongoose';
import { config } from '../../config/index.js';

export class ReminderService {
  constructor(private readonly repo: ReminderRepository = reminderRepository) {}

  async create(userId: string, data: CreateReminderRequest, createdBy: 'user' | 'ai' = 'user'): Promise<IReminder> {
    const scheduledDate = new Date(data.scheduledAt);

    const reminder = await this.repo.create({
      userId: new mongoose.Types.ObjectId(userId) as unknown as mongoose.Types.ObjectId,
      title: data.title,
      description: data.description,
      scheduledAt: scheduledDate,
      timezone: data.timezone || config.DEFAULT_TIMEZONE,
      recurrence: data.recurrence || RecurrenceType.NONE,
      recurrenceRule: data.recurrenceRule,
      notifyVia: data.notifyVia || ['websocket', 'telegram'],
      notifyDeviceId: data.notifyDeviceId
        ? (new mongoose.Types.ObjectId(data.notifyDeviceId) as unknown as mongoose.Types.ObjectId)
        : undefined,
      status: ReminderStatus.ACTIVE,
      createdBy,
    });

    // Schedule BullMQ job
    try {
      const jobId = await scheduleReminderJob(reminder.id, scheduledDate);
      await this.repo.updateById(reminder.id, { $set: { jobId } });
    } catch {
      // Redis queue fallback
    }

    return reminder;
  }

  async getById(id: string, userId: string): Promise<IReminder> {
    const reminder = await this.repo.findById(id);
    if (!reminder || reminder.userId.toString() !== userId) {
      throw new NotFoundError('Reminder');
    }
    return reminder;
  }

  async list(userId: string, page = 1, limit = 20) {
    return this.repo.findPaginated(
      { userId: new mongoose.Types.ObjectId(userId) },
      { page, limit, sort: { scheduledAt: 1 } }
    );
  }

  async update(id: string, userId: string, data: UpdateReminderRequest): Promise<IReminder> {
    const reminder = await this.getById(id, userId);

    const updateObj: Record<string, unknown> = { ...data };
    if (data.scheduledAt) {
      const newDate = new Date(data.scheduledAt);
      updateObj.scheduledAt = newDate;

      // Reschedule job
      if (reminder.jobId) {
        await removeReminderJob(reminder.jobId);
      }
      const newJobId = await scheduleReminderJob(reminder.id, newDate);
      updateObj.jobId = newJobId;
    }

    const updated = await this.repo.updateById(id, { $set: updateObj });
    return updated!;
  }

  async delete(id: string, userId: string): Promise<void> {
    const reminder = await this.getById(id, userId);
    if (reminder.jobId) {
      await removeReminderJob(reminder.jobId);
    }
    await this.repo.deleteById(id);
  }
}

export const reminderService = new ReminderService();
