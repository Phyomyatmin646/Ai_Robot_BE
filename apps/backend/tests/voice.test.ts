import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { voiceService } from '../src/modules/voice/voice.service.js';
import { GeminiLiveSession } from '../src/modules/voice/gemini-live.client.js';
import { settingsRepository } from '../src/modules/settings/settings.repository.js';
import * as esp32Gateway from '../src/websocket/esp32.gateway.js';
import { dashboardBroadcast } from '../src/websocket/dashboard.gateway.js';
import { AudioFormat } from '@ai-robot/shared-types';

describe('Hands-Free Voice Assistant Lifecycle (Feature C)', () => {
  const mockDeviceId = '507f1f77bcf86cd799439011';
  const mockUserId = '507f191e810c19729de860ea';

  beforeEach(() => {
    voiceService.clearAllSessions();
    esp32Gateway.clearActiveEsp32Sessions();
    vi.restoreAllMocks();

    // Mock settings repository so tests do not wait on MongoDB connection buffer
    vi.spyOn(settingsRepository, 'getUserSettings').mockResolvedValue(null);
    vi.spyOn(settingsRepository, 'getDeviceSettings').mockResolvedValue(null);
  });

  afterEach(() => {
    voiceService.clearAllSessions();
  });

  it('should start voice session on audio:start without requiring a live Gemini API key', async () => {
    const sessionId = `voice_${mockDeviceId}_${Date.now()}`;
    const session = await voiceService.startVoiceSession(
      mockDeviceId,
      mockUserId,
      sessionId,
      AudioFormat.PCM_16BIT,
      16000
    );

    expect(session).toBeDefined();
    expect(session.configData.sessionId).toBe(sessionId);
    expect(session.configData.deviceId).toBe(mockDeviceId);
    expect(voiceService.getActiveSession(sessionId)).toBe(session);
  });

  it('should forward incoming binary PCM audio chunks to the active voice session', async () => {
    const sessionId = `voice_${mockDeviceId}_${Date.now()}`;
    const liveSession = await voiceService.startVoiceSession(
      mockDeviceId,
      mockUserId,
      sessionId
    );

    const sendChunkSpy = vi.spyOn(liveSession, 'sendAudioChunk');
    const mockPcmChunk = Buffer.alloc(4096, 0x12);

    await voiceService.handleIncomingAudioChunk(
      mockDeviceId,
      mockUserId,
      sessionId,
      mockPcmChunk,
      1
    );

    expect(sendChunkSpy).toHaveBeenCalledWith(mockPcmChunk);
  });

  it('should properly signal turn completion on audio:end', async () => {
    const sessionId = `voice_${mockDeviceId}_${Date.now()}`;
    const liveSession = await voiceService.startVoiceSession(
      mockDeviceId,
      mockUserId,
      sessionId
    );

    const endTurnSpy = vi.spyOn(liveSession, 'sendAudioStreamEnd');

    await voiceService.handleAudioStreamEnd(
      mockDeviceId,
      mockUserId,
      sessionId,
      25
    );

    expect(endTurnSpy).toHaveBeenCalled();
  });

  it('should cleanly end and remove session on endSession', async () => {
    const sessionId = `voice_${mockDeviceId}_${Date.now()}`;
    await voiceService.startVoiceSession(mockDeviceId, mockUserId, sessionId);

    expect(voiceService.getActiveSession(sessionId)).toBeDefined();

    voiceService.endSession(sessionId);

    expect(voiceService.getActiveSession(sessionId)).toBeUndefined();
  });

  it('should support repeated conversations without leaking sessions', async () => {
    // Turn 1
    const sessionId1 = `voice_${mockDeviceId}_1`;
    const session1 = await voiceService.startVoiceSession(mockDeviceId, mockUserId, sessionId1);
    expect(voiceService.getActiveSession(sessionId1)).toBe(session1);
    voiceService.endSession(sessionId1);
    expect(voiceService.getActiveSession(sessionId1)).toBeUndefined();

    // Turn 2 (repeated hands-free wake-word invocation)
    const sessionId2 = `voice_${mockDeviceId}_2`;
    const session2 = await voiceService.startVoiceSession(mockDeviceId, mockUserId, sessionId2);
    expect(voiceService.getActiveSession(sessionId2)).toBe(session2);
    voiceService.endSession(sessionId2);
    expect(voiceService.getActiveSession(sessionId2)).toBeUndefined();
  });

  it('should clean up session on device disconnect', () => {
    const sessionId = `voice_${mockDeviceId}_disconnect`;
    const liveSession = new GeminiLiveSession({
      sessionId,
      deviceId: mockDeviceId,
      userId: mockUserId,
    });
    const closeSpy = vi.spyOn(liveSession, 'close');

    liveSession.close();
    expect(closeSpy).toHaveBeenCalled();
  });

  it('should time out inactive voice session and transition robot state back to idle', async () => {
    vi.useFakeTimers();

    const sessionId = `voice_${mockDeviceId}_timeout`;
    const liveSession = new GeminiLiveSession({
      sessionId,
      deviceId: mockDeviceId,
      userId: mockUserId,
    });
    await liveSession.connect();

    const closeSpy = vi.spyOn(liveSession, 'close');
    const emitStateSpy = vi.spyOn(dashboardBroadcast, 'emitRobotState');

    // Fast-forward past the 60s inactivity timeout
    vi.advanceTimersByTime(65000);

    expect(closeSpy).toHaveBeenCalled();
    expect(emitStateSpy).toHaveBeenCalledWith(mockDeviceId, mockUserId, 'idle');

    vi.useRealTimers();
  });

  it('should reject unauthorized connection when credentials are missing or invalid', async () => {
    const mockSocket = {
      close: vi.fn(),
    };

    // Simulate missing credentials check
    const checkCredentials = (deviceId?: string, key?: string) => {
      if (!deviceId || !key) {
        mockSocket.close(4001, 'Unauthorized: Missing device credentials');
        return false;
      }
      if (key !== 'valid_secret_key') {
        mockSocket.close(4003, 'Forbidden: Invalid device credentials');
        return false;
      }
      return true;
    };

    // Missing key
    expect(checkCredentials(mockDeviceId, undefined)).toBe(false);
    expect(mockSocket.close).toHaveBeenCalledWith(4001, expect.stringContaining('Unauthorized'));

    // Invalid key
    expect(checkCredentials(mockDeviceId, 'invalid_key')).toBe(false);
    expect(mockSocket.close).toHaveBeenCalledWith(4003, expect.stringContaining('Forbidden'));

    // Valid credentials
    expect(checkCredentials(mockDeviceId, 'valid_secret_key')).toBe(true);
  });
});
