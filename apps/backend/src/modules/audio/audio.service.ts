import { audioRepository, AudioRepository } from './audio.repository.js';
import { IAudioMetadata } from './audio.model.js';
import { NotFoundError } from '../../shared/errors.js';
import { Readable } from 'node:stream';
import mongoose from 'mongoose';
import { AudioType, AudioFormat } from '@ai-robot/shared-types';

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
}

export const audioService = new AudioService();
