import { audioRepository, AudioRepository } from './audio.repository.js';
import { IAudioMetadata } from './audio.model.js';
import { NotFoundError, BadRequestError } from '../../shared/errors.js';
import { Readable } from 'node:stream';
import mongoose from 'mongoose';
import { AudioType, AudioFormat } from '@ai-robot/shared-types';
import {
  getActiveEsp32Session,
  getAllActiveEsp32Sessions,
  sendAudioChunkToEsp32,
  sendControlMessageToEsp32,
  sendAudioCancelToEsp32,
  esp32AudioEvents,
  waitForEsp32AudioReady,
} from '../../websocket/esp32.gateway.js';
import { dashboardBroadcast } from '../../websocket/dashboard.gateway.js';
import { logger } from '../../utils/logger.js';

export interface AudioFilterOptions {
  userId: string;
  deviceId?: string;
  conversationId?: string;
  audioType?: AudioType;
  fromDate?: Date;
  toDate?: Date;
  page?: number;
  limit?: number;
}

/**
 * Production Linear Interpolation Resampler: converts any PCM sample rate (16kHz, 22.05kHz, 44.1kHz, 48kHz)
 * cleanly into unified 24,000 Hz 16-bit mono PCM for physical I2S output.
 */
function resamplePcmTo24k(input: Buffer, sourceRate: number): Buffer {
  if (sourceRate === 24000 || sourceRate <= 0) return input;
  const numSamples = Math.floor(input.length / 2);
  if (numSamples < 2) return input;
  const ratio = 24000 / sourceRate;
  const outSamples = Math.floor(numSamples * ratio);
  const output = Buffer.alloc(outSamples * 2);

  for (let outIdx = 0; outIdx < outSamples; outIdx++) {
    const srcPos = outIdx / ratio;
    const srcIdx = Math.floor(srcPos);
    const frac = srcPos - srcIdx;

    const s0 = input.readInt16LE(srcIdx * 2);
    const s1 = (srcIdx + 1 < numSamples) ? input.readInt16LE((srcIdx + 1) * 2) : s0;
    const interp = Math.round(s0 + frac * (s1 - s0));
    const clamped = Math.max(-32768, Math.min(32767, interp));
    output.writeInt16LE(clamped, outIdx * 2);
  }
  return output;
}

export class AudioService {
  private readonly playbacks = new Map<string, symbol>();

  constructor(private readonly repo: AudioRepository = audioRepository) {}

  async saveAudio(params: {
    userId: string;
    deviceId?: string;
    conversationId?: string;
    fileName: string;
    mimeType: string;
    format: AudioFormat;
    sampleRate: number;
    duration: number;
    fileSize: number;
    audioType: AudioType;
    stream: Readable;
  }): Promise<IAudioMetadata> {
    const storageRef = await this.repo.uploadToGridFS(params.fileName, params.stream, params.mimeType);

    return this.repo.create({
      userId: new mongoose.Types.ObjectId(params.userId) as unknown as mongoose.Types.ObjectId,
      deviceId: params.deviceId ? (new mongoose.Types.ObjectId(params.deviceId) as unknown as mongoose.Types.ObjectId) : undefined,
      conversationId: params.conversationId ? (new mongoose.Types.ObjectId(params.conversationId) as unknown as mongoose.Types.ObjectId) : undefined,
      fileName: params.fileName,
      mimeType: params.mimeType,
      format: params.format,
      sampleRate: params.sampleRate,
      channels: 1,
      bitDepth: 16,
      duration: params.duration,
      fileSize: params.fileSize,
      audioType: params.audioType,
      storageRef,
      storageType: 'gridfs',
    });
  }

  async getById(id: string, userId: string): Promise<IAudioMetadata> {
    const audio = await this.repo.findById(id);
    if (!audio || audio.userId.toString() !== userId) {
      throw new NotFoundError('Audio recording');
    }
    return audio;
  }

  async list(options: AudioFilterOptions) {
    const filter: Record<string, unknown> = {
      userId: new mongoose.Types.ObjectId(options.userId),
    };

    if (options.deviceId) filter.deviceId = new mongoose.Types.ObjectId(options.deviceId);
    if (options.conversationId) filter.conversationId = new mongoose.Types.ObjectId(options.conversationId);
    if (options.audioType) filter.audioType = options.audioType;

    if (options.fromDate || options.toDate) {
      filter.createdAt = {};
      if (options.fromDate) (filter.createdAt as Record<string, unknown>).$gte = options.fromDate;
      if (options.toDate) (filter.createdAt as Record<string, unknown>).$lte = options.toDate;
    }

    return this.repo.findPaginated(filter, {
      page: options.page || 1,
      limit: options.limit || 20,
      sort: { createdAt: -1 },
    });
  }

  getAudioStream(audio: IAudioMetadata, rangeHeader?: string) {
    const fileSize = audio.fileSize;

    if (!rangeHeader) {
      return {
        stream: this.repo.getDownloadStreamFromGridFS(audio.storageRef),
        statusCode: 200,
        headers: {
          'Content-Type': audio.mimeType,
          'Content-Length': fileSize,
          'Accept-Ranges': 'bytes',
        },
      };
    }

    const parts = rangeHeader.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunkSize = end - start + 1;

    return {
      stream: this.repo.getDownloadStreamFromGridFS(audio.storageRef, { start, end: end + 1 }),
      statusCode: 206,
      headers: {
        'Content-Type': audio.mimeType,
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
      },
    };
  }

  async delete(id: string, userId: string): Promise<void> {
    const audio = await this.getById(id, userId);
    await this.repo.deleteFromGridFS(audio.storageRef);
    await this.repo.deleteById(audio.id);
  }

  /**
   * Ultra-low-latency direct streaming playback of database audio onto the physical robot speaker
   */
  async playOnDevice(audioId: string, userId: string, targetDeviceId?: string): Promise<{ success: boolean; deviceId: string; fileName: string }> {
    const audio = await this.getById(audioId, userId);

    // Locate active robot session
    let targetSession = targetDeviceId ? getActiveEsp32Session(targetDeviceId) : undefined;
    if (!targetSession) {
      // Find user's active connected robot
      const userSessions = getAllActiveEsp32Sessions().filter((s) => s.userId === userId);
      if (userSessions.length > 0) {
        targetSession = userSessions[0];
      } else {
        const allSessions = getAllActiveEsp32Sessions();
        if (allSessions.length > 0) {
          targetSession = allSessions[0];
        } else {
          throw new BadRequestError('Cannot play audio: Robot is powered off or not connected via WebSocket');
        }
      }
    }

    const deviceId = targetSession.deviceId;
    const token = Symbol();
    this.playbacks.set(deviceId, token);
    const isCurrent = () => this.playbacks.get(deviceId) === token;
    const playSessionId = `playback_${audioId}_${Date.now()}`;

    logger.info({ audioId, deviceId, fileName: audio.fileName }, 'Starting direct low-latency audio stream to ESP32 robot');

    // 1. Notify ESP32 that audio playback is starting
    sendControlMessageToEsp32(deviceId, 'audio:response:start', {
      sessionId: playSessionId,
      format: audio.format || AudioFormat.PCM_16BIT,
      sampleRate: 24000,
      channels: audio.channels || 1,
      bitDepth: audio.bitDepth || 16,
      fileName: audio.fileName,
      totalSize: audio.fileSize,
    });

    // 2. Handshake: Wait for ESP32 Audio Engine to flush previous audio and acknowledge readiness
    const isReady = await waitForEsp32AudioReady(deviceId, playSessionId, 800);
    if (!isCurrent()) throw new BadRequestError('Playback was cancelled');
    if (!isReady) {
      this.playbacks.delete(deviceId);
      logger.error({ deviceId, playSessionId }, 'ESP32 audio readiness handshake failed or timed out. Aborting audio playback to prevent corrupting buffer.');
      throw new BadRequestError('ESP32 audio readiness handshake timed out');
    }
    logger.info({ deviceId, playSessionId }, 'ESP32 audio readiness confirmed by handshake ACK');

    // 3. Update robot state to 'speaking'
    targetSession.state = 'speaking';
    dashboardBroadcast.emitRobotState(deviceId, userId, 'speaking', playSessionId);

    // 4. Open GridFS download stream with watermark flow control
    const downloadStream = this.repo.getDownloadStreamFromGridFS(audio.storageRef);

    (async () => {
      let isPaused = false;
      const onFlow = (status: string) => {
        isPaused = (status === 'pause');
      };
      esp32AudioEvents.on(`flow:${deviceId}`, onFlow);

      try {
        let isFirst = true;
        let nextSend = performance.now() - 160;
        const CHUNK_SIZE = 960; // 960 bytes = 480 samples = 20.0ms at 24kHz 16-bit mono PCM
        const sRate = audio.sampleRate || 24000;

        for await (const chunk of downloadStream) {
          if (!isCurrent() || targetSession.state !== 'speaking') break; // stopped by user or interruption

          let pcmChunk = chunk as Buffer;
          if (isFirst && pcmChunk.length > 44 && pcmChunk.toString('ascii', 0, 4) === 'RIFF') {
            pcmChunk = pcmChunk.subarray(44);
          }
          isFirst = false;

          // Resample any non-24kHz source on the fly to 24kHz
          if (sRate !== 24000) {
            pcmChunk = resamplePcmTo24k(pcmChunk, sRate);
          }

          for (let offset = 0; offset < pcmChunk.length; offset += CHUNK_SIZE) {
            if (!isCurrent() || targetSession.state !== 'speaking') break;

            while (isPaused && isCurrent() && targetSession.state === 'speaking' && getActiveEsp32Session(deviceId) === targetSession) {
              await new Promise((r) => setTimeout(r, 10));
              nextSend = performance.now();
            }
            if (!isCurrent() || targetSession.state !== 'speaking' || getActiveEsp32Session(deviceId) !== targetSession) return;

            const slice = pcmChunk.subarray(offset, Math.min(offset + CHUNK_SIZE, pcmChunk.length));
            const sent = sendAudioChunkToEsp32(deviceId, slice);
            if (!sent) throw new Error('Device disconnected during playback');
            nextSend = Math.max(nextSend, performance.now() - 160) + slice.length / 48;
            const wait = nextSend - performance.now();
            if (wait > 0) await new Promise((r) => setTimeout(r, wait));
          }
        }

        if (!isCurrent() || targetSession.state !== 'speaking') return;
        logger.info({ audioId, deviceId }, 'Completed audio playback stream to ESP32 robot');
        sendControlMessageToEsp32(deviceId, 'audio:response:end', {
          sessionId: playSessionId,
          fileName: audio.fileName,
        });
        targetSession.state = 'idle';
        dashboardBroadcast.emitRobotState(deviceId, userId, 'idle', playSessionId);
      } catch (err) {
        if (!isCurrent()) return;
        logger.error({ err, audioId, deviceId }, 'Error streaming audio from GridFS to robot');
        sendControlMessageToEsp32(deviceId, 'audio:cancel', { reason: 'stream_read_error' });
        targetSession.state = 'idle';
        dashboardBroadcast.emitRobotState(deviceId, userId, 'idle', playSessionId);
      } finally {
        if (isCurrent()) this.playbacks.delete(deviceId);
        esp32AudioEvents.off(`flow:${deviceId}`, onFlow);
      }
    })();

    return {
      success: true,
      deviceId,
      fileName: audio.fileName,
    };
  }

  /**
   * Immediately silence playback on the robot (interruption)
   */
  async stopOnDevice(userId: string, targetDeviceId?: string): Promise<void> {
    const sessions = targetDeviceId
      ? [getActiveEsp32Session(targetDeviceId)].filter(Boolean)
      : getAllActiveEsp32Sessions().filter((s) => s.userId === userId);

    for (const session of sessions) {
      if (session) {
        this.playbacks.delete(session.deviceId);
        sendAudioCancelToEsp32(session.deviceId, 'user_stop_request');
        session.state = 'idle';
        dashboardBroadcast.emitRobotState(session.deviceId, userId, 'idle');
      }
    }
  }
}

export const audioService = new AudioService();

