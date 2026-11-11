import { BaseRepository } from '../../shared/base.repository.js';
import { IReminder, ReminderModel } from './reminder.model.js';
import mongoose from 'mongoose';
import { ReminderStatus } from '@ai-robot/shared-types';

export class ReminderRepository extends BaseRepository<IReminder> {
  constructor() {
    super(ReminderModel);
  }

  async findDueReminders(beforeTime: Date = new Date()): Promise<IReminder[]> {
    return this.model.find({
      status: ReminderStatus.ACTIVE,
      scheduledAt: { $lte: beforeTime },
    }).exec();
  }

  async markTriggered(id: string, nextTriggerAt?: Date): Promise<IReminder | null> {
    const update: Record<string, unknown> = {
      lastTriggeredAt: new Date(),
    };

    if (nextTriggerAt) {
      update.scheduledAt = nextTriggerAt;
      update.nextTriggerAt = nextTriggerAt;
      update.status = ReminderStatus.ACTIVE;
    } else {
      update.status = ReminderStatus.TRIGGERED;
    }

    return this.model.findByIdAndUpdate(id, { $set: update }, { new: true }).exec();
  }

  async snooze(id: string, snoozeUntil: Date): Promise<IReminder | null> {
    return this.model.findByIdAndUpdate(
      id,
      { $set: { status: ReminderStatus.SNOOZED, snoozeUntil, scheduledAt: snoozeUntil } },
      { new: true }
    ).exec();
  }
}

export const reminderRepository = new ReminderRepository();
