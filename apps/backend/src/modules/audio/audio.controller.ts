import { FastifyRequest, FastifyReply } from 'fastify';
import { audioService, AudioService } from './audio.service.js';
import { successResponse, paginatedResponse } from '../../shared/response.js';
import { AudioType, AudioFormat } from '@ai-robot/shared-types';
import { BadRequestError } from '../../shared/errors.js';
import { Readable } from 'node:stream';

export class AudioController {
  constructor(private readonly service: AudioService = audioService) {}

  upload = async (request: FastifyRequest, reply: FastifyReply) => {
    const data = await request.file();
    if (!data) {
      throw new BadRequestError('No audio file provided');
    }

    const fields = (data.fields || {}) as Record<string, any>;
    const title = (fields.title?.value as string) || data.filename || 'Uploaded Audio';
    const duration = Number(fields.duration?.value) || 0;

    const fileBuffer = await data.toBuffer();
    const stream = Readable.from(fileBuffer);

    let sampleRate = 16000;
    let format = AudioFormat.WAV;
    let mimeType = data.mimetype || 'audio/wav';

    // Check WAV header for sample rate
    if (fileBuffer.length > 28 && fileBuffer.toString('ascii', 0, 4) === 'RIFF') {
      sampleRate = fileBuffer.readUInt32LE(24) || 16000;
      format = AudioFormat.WAV;
    } else if (mimeType.includes('mp3') || data.filename.endsWith('.mp3')) {
      format = AudioFormat.MP3;
      mimeType = 'audio/mpeg';
    }

    const audio = await this.service.saveAudio({
      userId: request.user!.userId,
      fileName: title,
      mimeType,
      format,
      sampleRate,
      duration,
      fileSize: fileBuffer.length,
      audioType: AudioType.UPLOADED,
      stream,
    });

    return reply.status(201).send(successResponse(audio, 'Audio uploaded successfully'));
  };

  list = async (
    request: FastifyRequest<{
      Querystring: {
        page?: number;
        limit?: number;
        deviceId?: string;
        conversationId?: string;
        audioType?: AudioType;
        fromDate?: string;
        toDate?: string;
      };
    }>,
    reply: FastifyReply
  ) => {
    const { page, limit, deviceId, conversationId, audioType, fromDate, toDate } = request.query;

    const result = await this.service.list({
      userId: request.user!.userId,
      deviceId,
      conversationId,
      audioType,
      fromDate: fromDate ? new Date(fromDate) : undefined,
      toDate: toDate ? new Date(toDate) : undefined,
      page: Number(page) || 1,
      limit: Number(limit) || 20,
    });

    return reply.send(paginatedResponse(result.data, result.pagination));
  };

  getById = async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const audio = await this.service.getById(request.params.id, request.user!.userId);
    return reply.send(successResponse(audio));
  };

  /** Stream audio with HTTP 206 Partial Content (Range request) support */
  streamAudio = async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    const audio = await this.service.getById(request.params.id, request.user!.userId);
    const range = request.headers.range;

    const streamData = this.service.getAudioStream(audio, range);

    reply.code(streamData.statusCode);
    reply.headers(streamData.headers);
    return reply.send(streamData.stream);
  };

  delete = async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    await this.service.delete(request.params.id, request.user!.userId);
    return reply.send(successResponse(null, 'Audio recording deleted successfully'));
  };

  /** Trigger low-latency streaming playback of this audio file directly on the physical robot speaker */
  playOnDevice = async (
    request: FastifyRequest<{ Params: { id: string }; Body?: { deviceId?: string } }>,
    reply: FastifyReply
  ) => {
    const result = await this.service.playOnDevice(
      request.params.id,
      request.user!.userId,
      request.body?.deviceId
    );
    return reply.send(successResponse(result, 'Streaming audio directly to physical robot speaker'));
  };

  /** Stop/cancel audio playback on robot */
  stopOnDevice = async (
    request: FastifyRequest<{ Body?: { deviceId?: string; sessionId?: string } }>,
    reply: FastifyReply
  ) => {
    await this.service.stopOnDevice(request.user!.userId, request.body?.deviceId, request.body?.sessionId);
    return reply.send(successResponse(null, 'Robot playback stop requested'));
  };
}

export const audioController = new AudioController();

