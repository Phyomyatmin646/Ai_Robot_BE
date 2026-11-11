import { Queue } from 'bullmq';
import { getRedisClient } from '../config/redis.js';
import { APP_CONSTANTS } from '../shared/constants.js';
import { logger } from '../utils/logger.js';

let reminderQueue: Queue | null = null;

export function getReminderQueue(): Queue {
  if (reminderQueue) return reminderQueue;

  const redis = getRedisClient();
  reminderQueue = new Queue(APP_CONSTANTS.BULL_QUEUES.REMINDERS, {
    connection: redis,
    defaultJobOptions: {
      removeOnComplete: 100,
      removeOnFail: 500,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
    },
  });

  logger.info('BullMQ reminder queue initialized');
  return reminderQueue;
}

export async function scheduleReminderJob(reminderId: string, executeAt: Date): Promise<string> {
  const queue = getReminderQueue();
  const delay = Math.max(0, executeAt.getTime() - Date.now());

  const job = await queue.add(
    'process-reminder',
    { reminderId },
    {
      jobId: `rem_${reminderId}_${executeAt.getTime()}`,
      delay,
    }
  );

  return job.id!;
}

export async function removeReminderJob(jobId: string): Promise<void> {
  const queue = getReminderQueue();
  const job = await queue.getJob(jobId);
  if (job) {
    await job.remove();
  }
}

