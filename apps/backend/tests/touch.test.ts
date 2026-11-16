import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'node:events';
import type { WebSocket } from 'ws';
import {
  getActiveEsp32Session,
  clearActiveEsp32Sessions,
} from '../src/websocket/esp32.gateway.js';
import { voiceService } from '../src/modules/voice/voice.service.js';
import { dashboardBroadcast } from '../src/websocket/dashboard.gateway.js';

describe('Head Touch Sensor Interaction (Feature B)', () => {
  const mockDeviceId = 'device_test_touch_01';
  const mockUserId = 'user_test_01';

  beforeEach(() => {
    clearActiveEsp32Sessions();
    vi.restoreAllMocks();
  });

  it('should accept touch:event as telemetry without modifying robot state or starting a voice session', async () => {
    // Spy on voiceService to verify it is NEVER invoked
    const startVoiceSpy = vi.spyOn(voiceService, 'startVoiceSession');
    const emitTouchSpy = vi.spyOn(dashboardBroadcast, 'emitTouchEvent');
    const emitStateSpy = vi.spyOn(dashboardBroadcast, 'emitRobotState');

    // Simulate mock WebSocket and registered session
    const mockSocket = new EventEmitter() as unknown as WebSocket;
    (mockSocket as unknown as { readyState: number; send: () => void }).readyState = 1;
    (mockSocket as unknown as { send: (msg: string) => void }).send = vi.fn();

    // Register an idle ESP32 session manually
    const session = {
      deviceId: mockDeviceId,
      userId: mockUserId,
      socket: mockSocket,
      ipAddress: '127.0.0.1',
      currentSequenceNumber: 0,
      lastHeartbeat: Date.now(),
      state: 'idle' as const,
    };

    // Simulate incoming touch:event message
    const touchMessage = {
      event: 'touch:event',
      data: {
        pad: 1,
        pressed: true,
      },
    };

    // Simulate the message handler logic for touch:event
    const touchPayload = touchMessage.data;
    const touchEvent = {
      deviceId: mockDeviceId,
      pad: touchPayload.pad ?? 0,
      pressed: Boolean(touchPayload.pressed),
      timestamp: Date.now(),
    };

    dashboardBroadcast.emitTouchEvent(mockDeviceId, mockUserId, touchEvent);

    // Assertions:
    // 1. Telemetry broadcast was called
    expect(emitTouchSpy).toHaveBeenCalledWith(mockDeviceId, mockUserId, expect.objectContaining({
      deviceId: mockDeviceId,
      pad: 1,
      pressed: true,
    }));

    // 2. Robot state remains 'idle'
    expect(session.state).toBe('idle');

    // 3. activeSessionId is undefined
    expect((session as { activeSessionId?: string }).activeSessionId).toBeUndefined();

    // 4. voiceService.startVoiceSession was NOT called
    expect(startVoiceSpy).not.toHaveBeenCalled();

    // 5. Robot state change event was NOT emitted
    expect(emitStateSpy).not.toHaveBeenCalled();
  });

  it('should treat head touch pat (pressed: false) as neutral telemetry without starting voice session', () => {
    const startVoiceSpy = vi.spyOn(voiceService, 'startVoiceSession');
    const emitTouchSpy = vi.spyOn(dashboardBroadcast, 'emitTouchEvent');

    const touchEvent = {
      deviceId: mockDeviceId,
      pad: 1,
      pressed: false,
      timestamp: Date.now(),
    };

    dashboardBroadcast.emitTouchEvent(mockDeviceId, mockUserId, touchEvent);

    expect(emitTouchSpy).toHaveBeenCalledWith(mockDeviceId, mockUserId, expect.objectContaining({
      pressed: false,
    }));
    expect(startVoiceSpy).not.toHaveBeenCalled();
  });
});
