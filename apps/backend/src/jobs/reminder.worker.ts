import { Worker, Job } from 'bullmq';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { getRedisClient } from '../config/redis.js';
import { APP_CONSTANTS } from '../shared/constants.js';
import { logger } from '../utils/logger.js';
import { reminderRepository } from '../modules/reminders/reminder.repository.js';
import { notificationService } from '../modules/notifications/notification.service.js';
import { dashboardBroadcast } from '../websocket/dashboard.gateway.js';
import {
  sendControlMessageToEsp32,
  Esp32DeviceSession,
  waitForEsp32AudioReady,
  getActiveEsp32Session,
  getAllActiveEsp32Sessions,
} from '../websocket/esp32.gateway.js';
import { streamRecordedPcm } from '../websocket/pcm-playback.js';
import { NotificationType, RecurrenceType, ReminderStatus } from '@ai-robot/shared-types';

const ALARM_SAMPLE_RATE = 24000; // ESP32 speaker I2S rate.
const ALARM_PCM = generateAlarmToneBuffer();

function generateAlarmToneBuffer(): Buffer {
  const numSamples = ALARM_SAMPLE_RATE * 5 / 2;
  const buffer = Buffer.alloc(numSamples * 2);
  for (let i = 0; i < numSamples; i++) {
    const t = i / ALARM_SAMPLE_RATE;
    // Alternating chime frequencies (880Hz / 1320Hz)
    const freq = Math.floor(t * 4) % 2 === 0 ? 880 : 1320;
    const envelope = Math.sin(Math.PI * ((t * 4) % 1));
    const sample = Math.floor(Math.sin(2 * Math.PI * freq * t) * envelope * 22000);
    buffer.writeInt16LE(Math.max(-32767, Math.min(32767, sample)), i * 2);
  }
  return buffer;
}

async function ringReminderOnRobot(session: Esp32DeviceSession): Promise<void> {
  const { deviceId, userId } = session;
  const connected = () => getActiveEsp32Session(deviceId) === session;
  // Give an ongoing conversation or audio stream time to finish.
  const deadline = Date.now() + 20_000;
  while (connected() && (session.state !== 'idle' || session.outputSessionId)) {
    if (Date.now() >= deadline) {
      logger.warn({ deviceId }, 'Robot stayed busy at reminder time');
      return;
    }
    await delay(250);
  }
  if (!connected()) return;

  const sessionId = `alarm_${randomUUID()}`;
  const ready = waitForEsp32AudioReady(deviceId, sessionId, 1500);
  if (!sendControlMessageToEsp32(deviceId, 'audio:response:start', {
    sessionId,
    format: 'pcm_16bit',
    sampleRate: ALARM_SAMPLE_RATE,
    channels: 1,
    wireCodec: session.playbackCodec,
  })) return;

  session.state = 'speaking';
  dashboardBroadcast.emitRobotState(deviceId, userId, 'speaking', sessionId);
  const ownsPlayback = () => connected() && session.outputSessionId === sessionId;
  const canPlay = () => ownsPlayback() && session.state === 'speaking';
  let complete = false;
  try {
    if (await ready && canPlay()) {
      complete = await streamRecordedPcm(deviceId, sessionId, [ALARM_PCM], canPlay);
    }
    if (!complete) logger.warn({ deviceId, sessionId }, 'Robot reminder audio delivery incomplete');
  } catch (err) {
    logger.warn({ deviceId, sessionId, err }, 'Failed to play robot reminder');
  } finally {
    if (ownsPlayback()) {
      sendControlMessageToEsp32(deviceId, complete ? 'audio:response:end' : 'audio:cancel', { sessionId });
    }
    if (connected() && !session.outputSessionId && session.state === 'speaking') {
      session.state = 'idle';
      dashboardBroadcast.emitRobotState(deviceId, userId, 'idle', sessionId);
    }
  }
}

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

      if (reminder.status !== ReminderStatus.ACTIVE || reminder.scheduledAt.getTime() > Date.now()) return;

      const userId = reminder.userId.toString();
      const targetId = reminder.notifyDeviceId?.toString();
      const targetSessions = reminder.notifyVia.includes('device')
        ? getAllActiveEsp32Sessions().filter((session) =>
            session.userId === userId && (!targetId || session.deviceId === targetId))
        : [];
      await notificationService.send({
        userId,
        type: NotificationType.REMINDER,
        title: `Reminder: ${reminder.title}`,
        message: reminder.description || reminder.title,
        channels: reminder.notifyVia,
        data: { reminderId: reminder.id },
      });
      dashboardBroadcast.emitReminderAlert(userId, reminder.id, reminder.title);

      const results = await Promise.allSettled(targetSessions.map(ringReminderOnRobot));
      for (const result of results) {
        if (result.status === 'rejected') logger.warn({ reminderId, err: result.reason }, 'Robot reminder failed');
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

