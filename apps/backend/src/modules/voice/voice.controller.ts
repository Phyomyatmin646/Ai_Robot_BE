import { FastifyRequest, FastifyReply } from 'fastify';
import { voiceService, VoiceService } from './voice.service.js';
import { successResponse } from '../../shared/response.js';
import { config } from '../../config/index.js';

export class VoiceController {
  constructor(private readonly service: VoiceService = voiceService) {}

  getConfig = async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(
      successResponse({
        mode: config.VOICE_MODE,
        model: config.VOICE_MODEL,
        defaultLanguage: config.DEFAULT_LANGUAGE,
        supportedLanguages: config.supportedLanguagesList,
        sampleRate: config.AUDIO_SAMPLE_RATE,
        chunkSize: config.AUDIO_CHUNK_SIZE,
      })
    );
  };
}

export const voiceController = new VoiceController();

