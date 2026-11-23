import { audioRepository, AudioRepository } from './audio.repository.js';
import { IAudioMetadata } from './audio.model.js';
import { NotFoundError, BadRequestError } from '../../shared/errors.js';
import { Readable } from 'node:stream';
import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import { AudioType, AudioFormat } from '@ai-robot/shared-types';
import {
  getActiveEsp32Session,
  getAllActiveEsp32Sessions,
  sendControlMessageToEsp32,
  sendAudioCancelToEsp32,
  waitForEsp32AudioReady,
} from '../../websocket/esp32.gateway.js';
import { streamRecordedPcm } from '../../websocket/pcm-playback.js';
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
  private readonly playbacks = new Map<string, string>();

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
    if (!mongoose.isObjectIdOrHexString(id)) throw new BadRequestError('Invalid audio ID');
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
  async playOnDevice(audioId: string, userId: string, targetDeviceId?: string): Promise<{ success: boolean; deviceId: string; fileName: string; sessionId: string }> {
    const audio = await this.getById(audioId, userId);

    const targetSession = targetDeviceId
      ? getActiveEsp32Session(targetDeviceId)
      : getAllActiveEsp32Sessions().find((session) => session.userId === userId);
    if (targetSession?.userId !== userId) {
      throw new BadRequestError('Cannot play audio: Selected robot is not connected');
    }

    const deviceId = targetSession.deviceId;
    const playSessionId = `playback_${randomUUID()}`;

    this.playbacks.set(deviceId, playSessionId);
    const isCurrent = () => this.playbacks.get(deviceId) === playSessionId;

    logger.info({ audioId, deviceId, fileName: audio.fileName }, 'Starting direct low-latency audio stream to ESP32 robot');

    // 1. Notify ESP32 that audio playback is starting
    const readyAck = waitForEsp32AudioReady(deviceId, playSessionId, 800);
    sendControlMessageToEsp32(deviceId, 'audio:response:start', {
      sessionId: playSessionId,
      wireCodec: targetSession.playbackCodec,
      format: audio.format || AudioFormat.PCM_16BIT,
      sampleRate: 24000,
      channels: audio.channels || 1,
      bitDepth: audio.bitDepth || 16,
      fileName: audio.fileName,
      totalSize: audio.fileSize,
    });

    // 2. Handshake: Wait for ESP32 Audio Engine to flush previous audio and acknowledge readiness
    const isReady = await readyAck;
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
      const canPlay = () => isCurrent()
        && targetSession.state === 'speaking'
        && getActiveEsp32Session(deviceId) === targetSession;
      async function* pcmChunks() {
        let first = true;
        for await (const chunk of downloadStream) {
          let pcm = chunk as Buffer;
          if (first && pcm.length > 44 && pcm.toString('ascii', 0, 4) === 'RIFF') {
            pcm = pcm.subarray(44);
          }
          first = false;
          yield resamplePcmTo24k(pcm, audio.sampleRate || 24000);
        }
      }

      try {
        const complete = await streamRecordedPcm(deviceId, playSessionId, pcmChunks(), canPlay);
        if (!canPlay()) return;
        if (!complete) throw new Error('Device disconnected during playback');
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
      }
    })();

    return {
      success: true,
      deviceId,
      fileName: audio.fileName,
      sessionId: playSessionId,
    };
  }

  /**
   * Immediately silence playback on the robot (interruption)
   */
  async stopOnDevice(userId: string, targetDeviceId?: string, playbackSessionId?: string): Promise<void> {
    const sessions = getAllActiveEsp32Sessions().filter((session) =>
      session.userId === userId && (!targetDeviceId || session.deviceId === targetDeviceId));
    if (targetDeviceId && sessions.length === 0) {
      throw new BadRequestError('Cannot stop audio: Selected robot is not connected');
    }

    for (const session of sessions) {
      const currentPlayback = this.playbacks.get(session.deviceId);
      if (playbackSessionId) {
        if (currentPlayback && currentPlayback !== playbackSessionId) continue;
        if (!sendControlMessageToEsp32(session.deviceId, 'audio:cancel', {
          reason: 'user_stop_request',
          sessionId: playbackSessionId,
        })) {
          throw new BadRequestError('Cannot stop audio: Selected robot is not connected');
        }
        // The ESP32 may still be draining this playback after the sender has finished.
        if (!currentPlayback) continue;
      } else {
        sendAudioCancelToEsp32(session.deviceId, 'user_stop_request');
      }
      this.playbacks.delete(session.deviceId);
      session.state = 'idle';
      dashboardBroadcast.emitRobotState(session.deviceId, userId, 'idle');
    }
  }
}

export const audioService = new AudioService();

