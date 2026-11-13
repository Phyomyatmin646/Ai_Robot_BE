import { FastifyRequest, FastifyReply } from 'fastify';
import { audioService, AudioService } from './audio.service.js';
import { successResponse, paginatedResponse } from '../../shared/response.js';
import { AudioType } from '@ai-robot/shared-types';

export class AudioController {
  constructor(private readonly service: AudioService = audioService) {}

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
    request: FastifyRequest<{ Body?: { deviceId?: string } }>,
    reply: FastifyReply
  ) => {
    await this.service.stopOnDevice(request.user!.userId, request.body?.deviceId);
    return reply.send(successResponse(null, 'Audio playback stopped on robot'));
  };
}

export const audioController = new AudioController();

