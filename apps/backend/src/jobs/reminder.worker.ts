import { Worker, Job } from 'bullmq';
import { getRedisClient } from '../config/redis.js';
import { APP_CONSTANTS } from '../shared/constants.js';
import { logger } from '../utils/logger.js';
import { reminderRepository } from '../modules/reminders/reminder.repository.js';
import { notificationService } from '../modules/notifications/notification.service.js';
import { dashboardBroadcast } from '../websocket/dashboard.gateway.js';
import { sendControlMessageToEsp32 } from '../websocket/esp32.gateway.js';
import { NotificationType, RecurrenceType } from '@ai-robot/shared-types';

export function startReminderWorker(): Worker {
  const redis = getRedisClient();

  const worker = new Worker(
    APP_CONSTANTS.BULL_QUEUES.REMINDERS,
    async (job: Job<{ reminderId: string }>) => {
      const { reminderId } = job.data;
      logger.info({ reminderId }, 'Processing scheduled reminder job');

      const reminder = await reminderRepository.findById(reminderId);
      if (!reminder) {
        logger.warn({ reminderId }, 'Reminder not found for job execution');
        return;
      }

      // 1. Send cross-channel notifications (Telegram, WebSocket)
      await notificationService.send({
        userId: reminder.userId.toString(),
        type: NotificationType.REMINDER,
        title: `Reminder: ${reminder.title}`,
        message: reminder.description || reminder.title,
        channels: reminder.notifyVia,
        data: { reminderId: reminder.id },
      });

      // 2. Alert Web Dashboard via Socket.IO
      dashboardBroadcast.emitReminderAlert(reminder.userId.toString(), reminder.id, reminder.title);

      // 3. Alert physical ESP32 Robot if designated
      if (reminder.notifyDeviceId) {
        sendControlMessageToEsp32(reminder.notifyDeviceId.toString(), 'reminder:alert', {
          reminderId: reminder.id,
          title: reminder.title,
        });
      }

      // 4. Calculate next occurrence if recurring
      let nextTriggerAt: Date | undefined;
      if (reminder.recurrence && reminder.recurrence !== RecurrenceType.NONE) {
        const next = new Date(reminder.scheduledAt);
        if (reminder.recurrence === RecurrenceType.DAILY) {
          next.setDate(next.getDate() + 1);
        } else if (reminder.recurrence === RecurrenceType.WEEKLY) {
          next.setDate(next.getDate() + 7);
        } else if (reminder.recurrence === RecurrenceType.MONTHLY) {
          next.setMonth(next.getMonth() + 1);
        } else if (reminder.recurrence === RecurrenceType.YEARLY) {
          next.setFullYear(next.getFullYear() + 1);
        }
        nextTriggerAt = next;
      }

      await reminderRepository.markTriggered(reminder.id, nextTriggerAt);
      logger.info({ reminderId, nextTriggerAt }, 'Reminder triggered and updated');
    },
    {
      connection: redis,
      concurrency: 5,
    }
  );

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'Reminder job processing failed');
  });

  return worker;
}

