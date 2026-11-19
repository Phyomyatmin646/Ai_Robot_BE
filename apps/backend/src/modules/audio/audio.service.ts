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

export class AudioService {
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
    const playSessionId = `playback_${audioId}_${Date.now()}`;

    logger.info({ audioId, deviceId, fileName: audio.fileName }, 'Starting direct low-latency audio stream to ESP32 robot');

    // 1. Notify ESP32 that audio playback is starting
    sendControlMessageToEsp32(deviceId, 'audio:response:start', {
      sessionId: playSessionId,
      format: audio.format || AudioFormat.PCM_16BIT,
      sampleRate: audio.sampleRate || 16000,
      channels: audio.channels || 1,
      bitDepth: audio.bitDepth || 16,
      fileName: audio.fileName,
      totalSize: audio.fileSize,
    });

    // 2. Update robot state to 'speaking'
    targetSession.state = 'speaking';
    dashboardBroadcast.emitRobotState(deviceId, userId, 'speaking', playSessionId);

    // 3. Open GridFS download stream and stream directly as binary WebSocket frames
    const downloadStream = this.repo.getDownloadStreamFromGridFS(audio.storageRef);

    let isFirstChunk = true;
    downloadStream.on('data', (chunk: Buffer) => {
      let pcmChunk = chunk;
      // Strip 44-byte WAV header on first chunk if present so pure PCM 16-bit reaches the DAC
      if (isFirstChunk && chunk.length > 44 && chunk.toString('ascii', 0, 4) === 'RIFF') {
        pcmChunk = chunk.subarray(44);
      }
      isFirstChunk = false;
      sendAudioChunkToEsp32(deviceId, pcmChunk);
    });

    downloadStream.on('end', () => {
      logger.info({ audioId, deviceId }, 'Completed audio playback stream to ESP32 robot');
      sendControlMessageToEsp32(deviceId, 'audio:response:end', {
        sessionId: playSessionId,
        fileName: audio.fileName,
      });
      targetSession!.state = 'idle';
      dashboardBroadcast.emitRobotState(deviceId, userId, 'idle', playSessionId);
    });

    downloadStream.on('error', (err) => {
      logger.error({ err, audioId, deviceId }, 'Error streaming audio from GridFS to robot');
      sendControlMessageToEsp32(deviceId, 'audio:cancel', { reason: 'stream_read_error' });
      targetSession!.state = 'idle';
      dashboardBroadcast.emitRobotState(deviceId, userId, 'idle', playSessionId);
    });

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
        sendAudioCancelToEsp32(session.deviceId, 'user_stop_request');
        session.state = 'idle';
        dashboardBroadcast.emitRobotState(session.deviceId, userId, 'idle');
      }
    }
  }
}

export const audioService = new AudioService();

