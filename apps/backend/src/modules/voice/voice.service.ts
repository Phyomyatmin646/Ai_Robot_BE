import { logger } from '../../utils/logger.js';
import { GeminiLiveSession } from './gemini-live.client.js';
import { settingsRepository } from '../settings/settings.repository.js';
import { AudioFormat } from '@ai-robot/shared-types';

export class VoiceService {
  private activeSessions = new Map<string, GeminiLiveSession>();

  async startVoiceSession(
    deviceId: string,
    userId: string,
    sessionId: string,
    _format: AudioFormat = AudioFormat.PCM_16BIT,
    _sampleRate = 16000
  ): Promise<GeminiLiveSession> {
    // If a session already exists, close it cleanly
    const existing = this.activeSessions.get(sessionId);
    if (existing) {
      existing.close();
      this.activeSessions.delete(sessionId);
    }

    // Retrieve user and device settings
    const [userSettings, deviceSettings] = await Promise.all([
      settingsRepository.getUserSettings(userId),
      settingsRepository.getDeviceSettings(deviceId),
    ]);

    const liveSession = new GeminiLiveSession({
      sessionId,
      deviceId,
      userId,
      language: userSettings?.ai?.responseLanguage || 'en',
      systemPrompt: userSettings?.ai?.systemPrompt || userSettings?.ai?.personality,
      voiceName: deviceSettings?.voice?.voiceId || 'Puck',
    });

    try {
      await liveSession.connect();
      this.activeSessions.set(sessionId, liveSession);
      logger.info({ sessionId, deviceId }, 'Voice session started successfully');
    } catch (err) {
      logger.error({ err, sessionId }, 'Failed to start Gemini Live voice session');
    }

    return liveSession;
  }

  async handleIncomingAudioChunk(
    deviceId: string,
    userId: string,
    sessionId: string,
    chunk: Buffer,
    _sequenceNumber: number
  ): Promise<void> {
    let session = this.activeSessions.get(sessionId);
    if (!session) {
      session = await this.startVoiceSession(deviceId, userId, sessionId);
    }

    session.sendAudioChunk(chunk);
  }

  async handleAudioStreamEnd(
    _deviceId: string,
    _userId: string,
    sessionId: string,
    totalChunks?: number
  ): Promise<void> {
    logger.debug({ sessionId, totalChunks }, 'User audio stream end signaled');
    const session = this.activeSessions.get(sessionId);
    if (session) {
      session.sendAudioStreamEnd();
    }
  }

  getActiveSession(sessionId: string): GeminiLiveSession | undefined {
    return this.activeSessions.get(sessionId);
  }

  endSession(sessionId: string): void {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      session.close();
      this.activeSessions.delete(sessionId);
      logger.info({ sessionId }, 'Voice session ended');
    }
  }

  clearAllSessions(): void {
    for (const [id, session] of this.activeSessions.entries()) {
      session.close();
      this.activeSessions.delete(id);
    }
  }
}

export const voiceService = new VoiceService();

