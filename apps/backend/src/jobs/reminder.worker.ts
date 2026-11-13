import { Worker, Job } from 'bullmq';
import { getRedisClient } from '../config/redis.js';
import { APP_CONSTANTS } from '../shared/constants.js';
import { logger } from '../utils/logger.js';
import { reminderRepository } from '../modules/reminders/reminder.repository.js';
import { notificationService } from '../modules/notifications/notification.service.js';
import { dashboardBroadcast } from '../websocket/dashboard.gateway.js';
import {
  sendControlMessageToEsp32,
  sendAudioChunkToEsp32,
  getActiveEsp32Session,
  getAllActiveEsp32Sessions,
} from '../websocket/esp32.gateway.js';
import { NotificationType, RecurrenceType } from '@ai-robot/shared-types';

/**
 * Generate a clean 16-bit 16kHz dual-tone chime alarm sound in pure PCM
 */
function generateAlarmToneBuffer(durationSec = 2.5, sampleRate = 16000): Buffer {
  const numSamples = Math.floor(durationSec * sampleRate);
  const buffer = Buffer.alloc(numSamples * 2);
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    // Alternating chime frequencies (880Hz / 1320Hz)
    const freq = Math.floor(t * 4) % 2 === 0 ? 880 : 1320;
    const envelope = Math.sin(Math.PI * ((t * 4) % 1));
    const sample = Math.floor(Math.sin(2 * Math.PI * freq * t) * envelope * 22000);
    buffer.writeInt16LE(Math.max(-32767, Math.min(32767, sample)), i * 2);
  }
  return buffer;
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

      // 3. Ring alarm and flash LED on physical ESP32 Robot if powered on
      const targetSessions = reminder.notifyDeviceId
        ? [getActiveEsp32Session(reminder.notifyDeviceId.toString())].filter(Boolean)
        : getAllActiveEsp32Sessions().filter((s) => s.userId === reminder.userId.toString());

      for (const session of targetSessions) {
        if (session) {
          logger.info({ deviceId: session.deviceId, title: reminder.title }, 'Ringing physical alarm chime on ESP32 robot');

          // Send control event
          sendControlMessageToEsp32(session.deviceId, 'reminder:alert', {
            reminderId: reminder.id,
            title: reminder.title,
            playAlarm: true,
            timestamp: Date.now(),
          });

          // Stream alarm chime PCM audio directly to robot speaker
          const alarmPcm = generateAlarmToneBuffer(2.5, 16000);
          sendControlMessageToEsp32(session.deviceId, 'audio:response:start', {
            sessionId: `alarm_${reminder.id}_${Date.now()}`,
            format: 'pcm_16bit',
            sampleRate: 16000,
            channels: 1,
          });

          session.state = 'speaking';
          dashboardBroadcast.emitRobotState(session.deviceId, reminder.userId.toString(), 'speaking');

          const chunkSize = 4096;
          for (let offset = 0; offset < alarmPcm.length; offset += chunkSize) {
            const chunk = alarmPcm.subarray(offset, Math.min(offset + chunkSize, alarmPcm.length));
            sendAudioChunkToEsp32(session.deviceId, chunk);
          }

          setTimeout(() => {
            if (session) {
              sendControlMessageToEsp32(session.deviceId, 'audio:response:end', {
                sessionId: `alarm_${reminder.id}`,
              });
              session.state = 'idle';
              dashboardBroadcast.emitRobotState(session.deviceId, reminder.userId.toString(), 'idle');
            }
          }, 2600);
        }
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

