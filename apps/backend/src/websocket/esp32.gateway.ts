import { WebSocket } from 'ws';
import { EventEmitter } from 'events';
import { ADPCM_CODEC, ADPCM_PCM_FRAME_BYTES, encodeImaAdpcm } from './ima-adpcm.js';
import { FastifyInstance, FastifyRequest } from 'fastify';
import { logger } from '../utils/logger.js';
import { deviceService } from '../modules/devices/device.service.js';
import { deviceRepository } from '../modules/devices/device.repository.js';
import { dashboardBroadcast } from './dashboard.gateway.js';
import {
  DeviceStatus,
  ConnectionType,
  RobotState,
  TouchSensorEvent,
  DeviceHeartbeatEvent,
  AudioFormat,
} from '@ai-robot/shared-types';
import { voiceService } from '../modules/voice/voice.service.js';
import { rfidService } from '../modules/rfid/rfid.service.js';

export interface Esp32DeviceSession {
  deviceId: string;
  userId: string;
  socket: WebSocket;
  ipAddress: string;
  activeSessionId?: string;
  playbackCodec?: typeof ADPCM_CODEC;
  pausedPlaybackSessionId?: string;
  currentSequenceNumber: number;
  lastHeartbeat: number;
  state: RobotState;
}

// Global registry of active ESP32 connections
const activeConnections = new Map<string, Esp32DeviceSession>();

export const esp32AudioEvents = new EventEmitter();

export async function waitForEsp32AudioReady(deviceId: string, sessionId: string, timeoutMs = 800): Promise<boolean> {
  return new Promise((resolve) => {
    let timer: NodeJS.Timeout;
    const onReady = (_gen?: number) => {
      cleanup();
      resolve(true);
    };

    const cleanup = () => {
      clearTimeout(timer);
      esp32AudioEvents.off(`ready:${deviceId}:${sessionId}`, onReady);
    };

    timer = setTimeout(() => {
      cleanup();
      logger.warn({ deviceId, sessionId }, 'Timed out waiting for ESP32 audio:ready acknowledgement');
      resolve(false);
    }, timeoutMs);

    esp32AudioEvents.once(`ready:${deviceId}:${sessionId}`, onReady);
  });
}

export function getActiveEsp32Session(deviceId: string): Esp32DeviceSession | undefined {
  return activeConnections.get(deviceId);
}

export function getAllActiveEsp32Sessions(): Esp32DeviceSession[] {
  return Array.from(activeConnections.values());
}

export function clearActiveEsp32Sessions(): void {
  activeConnections.clear();
}

/**
 * Send an audio chunk as a binary WebSocket frame to the ESP32
 */
export function sendAudioChunkToEsp32(deviceId: string, chunk: Buffer | Uint8Array): boolean {
  const session = activeConnections.get(deviceId);
  if (!session || session.socket.readyState !== WebSocket.OPEN) {
    return false;
  }
  // Slice large audio frames into 4 KiB chunks to protect ESP32 memory and FreeRTOS RingBuffer
  const CHUNK_SIZE = 4096;
  for (let offset = 0; offset < chunk.length; offset += CHUNK_SIZE) {
    const slice = chunk.subarray(offset, Math.min(offset + CHUNK_SIZE, chunk.length));
    session.socket.send(slice, { binary: true });
  }
  return true;
}

/**
 * Send a JSON control event to the ESP32
 */
export function sendControlMessageToEsp32(deviceId: string, event: string, data: Record<string, unknown>): boolean {
  const session = activeConnections.get(deviceId);
  if (!session || session.socket.readyState !== WebSocket.OPEN) {
    return false;
  }
  if (event === 'audio:response:start') session.pausedPlaybackSessionId = undefined;
  const payload = JSON.stringify({
    event,
    timestamp: Date.now(),
    data,
  });
  session.socket.send(payload, { binary: false });
  return true;
}

// Only call for a response that advertised the negotiated codec in its start event.
export function sendPlaybackPcmToEsp32(deviceId: string, pcm: Buffer, codec?: typeof ADPCM_CODEC): boolean {
  if (!codec) return sendAudioChunkToEsp32(deviceId, pcm);
  for (let offset = 0; offset < pcm.length; offset += ADPCM_PCM_FRAME_BYTES) {
    const end = Math.min(offset + ADPCM_PCM_FRAME_BYTES, pcm.length & ~1);
    if (end > offset && !sendAudioChunkToEsp32(deviceId, encodeImaAdpcm(pcm.subarray(offset, end)))) return false;
  }
  return true;
}

/** Send cancel signal to ESP32 for barge-in interruption. */
export function sendAudioCancelToEsp32(deviceId: string, reason = 'interruption'): void {
  sendControlMessageToEsp32(deviceId, 'audio:cancel', { reason });
  const session = activeConnections.get(deviceId);
  if (session) {
    session.state = 'listening';
    dashboardBroadcast.emitRobotState(deviceId, session.userId, 'listening', session.activeSessionId);
  }
}

/**
 * Register the Native RFC 6455 WebSocket route for ESP32 devices
 */
export async function registerEsp32WebSocketRoute(fastify: FastifyInstance): Promise<void> {
  fastify.get('/ws/esp32', { websocket: true }, async (socket: WebSocket, req: FastifyRequest) => {
    // 1. Authenticate ESP32 via headers or query parameters
    const query = req.query as Record<string, string>;
    const deviceId = (req.headers['x-device-id'] as string) || query.deviceId;
    const apiKey = (req.headers['x-device-key'] as string) || query.key;
    const clientIp = (req.headers['x-forwarded-for'] as string) || req.ip;

    if (!deviceId || !apiKey) {
      logger.warn({ ip: clientIp }, 'ESP32 WebSocket connection rejected: Missing credentials');
      socket.close(4001, 'Unauthorized: Missing device credentials');
      return;
    }

    let device;
    try {
      device = await deviceService.verifyDeviceCredentials(deviceId, apiKey);
    } catch (err) {
      logger.warn({ deviceId, err }, 'ESP32 WebSocket connection rejected: Invalid credentials');
      socket.close(4003, 'Forbidden: Invalid device credentials');
      return;
    }

    const userId = device.userId.toString();

    // 2. Register Active Session
    const session: Esp32DeviceSession = {
      deviceId,
      userId,
      socket,
      ipAddress: clientIp,
      playbackCodec: req.headers['x-audio-codec'] === ADPCM_CODEC ? ADPCM_CODEC : undefined,
      currentSequenceNumber: 0,
      lastHeartbeat: Date.now(),
      state: 'idle',
    };
    activeConnections.set(deviceId, session);

    // Update DB status & session
    await deviceRepository.updateStatus(deviceId, DeviceStatus.ONLINE, clientIp);
    await deviceRepository.createSession(deviceId, userId, ConnectionType.WEBSOCKET, clientIp);

    // Notify Dashboard
    dashboardBroadcast.emitDeviceStatus(deviceId, userId, {
      deviceId,
      status: DeviceStatus.ONLINE,
      state: 'idle',
    });

    logger.info({ deviceId, mac: device.macAddress }, 'ESP32-S3 connected via native WebSocket');

    // 3. Send connect acknowledgment to ESP32
    sendControlMessageToEsp32(deviceId, 'device:connected', {
      deviceId,
      serverTime: Date.now(),
      sampleRate: device.config.audioSampleRate || 16000,
      chunkSize: device.config.audioChunkSize || 4096,
      heartbeatInterval: device.config.heartbeatInterval || 15,
    });

    // 4. Handle incoming messages from ESP32
    let opening: Promise<unknown> = Promise.resolve();
    socket.on('message', async (data: Buffer, isBinary: boolean) => {
      // -----------------------------------------------------------------
      // A. BINARY FRAME: Direct Raw PCM Audio Chunk (Zero JSON overhead!)
      // -----------------------------------------------------------------
      if (isBinary) {
        if (!session.activeSessionId) {
          // If no active session, start one automatically on incoming audio
          session.activeSessionId = `voice_${deviceId}_${Date.now()}`;
          session.state = 'listening';
          dashboardBroadcast.emitRobotState(deviceId, userId, 'listening', session.activeSessionId);
        }

        session.currentSequenceNumber++;

        // Stream audio chunk directly to Voice Service
        const id = session.activeSessionId;
        const seq = session.currentSequenceNumber;
        try {
          await opening;
          if (socket.readyState === WebSocket.OPEN && session.activeSessionId === id)
            await voiceService.handleIncomingAudioChunk(deviceId, userId, id, data, seq);
        } catch (err) { logger.warn({ deviceId, err }, 'Voice input session unavailable'); }
        return;
      }

      // -----------------------------------------------------------------
      // B. TEXT FRAME: JSON Control & Telemetry Messages
      // -----------------------------------------------------------------
      try {
        const message = JSON.parse(data.toString('utf-8'));
        const event = message.event || message.type;
        const payload = message.data || message.payload || {};

        switch (event) {
          case 'device:heartbeat': {
            session.lastHeartbeat = Date.now();
            const heartbeatData: DeviceHeartbeatEvent = {
              deviceId,
              timestamp: Date.now(),
              freeHeap: payload.freeHeap || 0,
              uptimeSeconds: payload.uptimeSeconds || 0,
              wifiRSSI: payload.wifiRSSI || 0,
              cpuTemp: payload.cpuTemp,
              batteryLevel: payload.batteryLevel,
            };
            dashboardBroadcast.emitDeviceHeartbeat(deviceId, userId, heartbeatData);
            break;
          }

          case 'touch:event': {
            const touchEvent: TouchSensorEvent = {
              deviceId,
              pad: payload.pad ?? 0,
              pressed: Boolean(payload.pressed),
              timestamp: Date.now(),
            };
            logger.info({ deviceId, pad: touchEvent.pad, pressed: touchEvent.pressed }, 'ESP32 head touch telemetry received');
            dashboardBroadcast.emitTouchEvent(deviceId, userId, touchEvent);

            // Head touch reaction sound is played locally on ESP32-S3 firmware.
            // Head touch is strictly telemetry/monitoring, NEVER Push-to-Talk.
            // It MUST NOT start a voice session, start listening mode, or invoke Gemini.
            break;
          }

          case 'rfid:scan': {
            await rfidService.handleRfidScan(deviceId, userId, payload);
            break;
          }

          case 'audio:start': {
            const activeSessionId = (payload.sessionId as string | undefined) || `voice_${deviceId}_${Date.now()}`;
            const previous = session.activeSessionId;
            if (previous && previous !== activeSessionId) voiceService.endSession(previous);
            session.activeSessionId = activeSessionId;
            session.currentSequenceNumber = 0;
            session.state = 'listening';
            dashboardBroadcast.emitRobotState(deviceId, userId, 'listening', activeSessionId);

            if (previous === activeSessionId && voiceService.getActiveSession(activeSessionId)?.usable()) break;
            opening = voiceService.startVoiceSession(
              deviceId,
              userId,
              activeSessionId,
              payload.format || AudioFormat.PCM_16BIT,
              payload.sampleRate || 16000
            ).then((live) => {
              if (!live.usable()) {
                if (session.activeSessionId === activeSessionId && socket.readyState === WebSocket.OPEN) {
                  sendAudioCancelToEsp32(deviceId, 'gemini_connect_failed');
                }
                throw new Error('Gemini connection failed');
              }
              if (session.activeSessionId !== activeSessionId || socket.readyState !== WebSocket.OPEN)
                voiceService.endSession(activeSessionId);
            });
            await opening;
            break;
          }

          case 'audio:end': {
            const id = session.activeSessionId;
            await opening;
            if (id !== session.activeSessionId) break;
            if (session.activeSessionId) {
              session.state = 'thinking';
              dashboardBroadcast.emitRobotState(deviceId, userId, 'thinking', session.activeSessionId);

              await voiceService.handleAudioStreamEnd(
                deviceId,
                userId,
                session.activeSessionId,
                payload.totalChunks || session.currentSequenceNumber
              );
            }
            break;
          }

          case 'audio:cancel': {
            const reason = (payload.reason as string | undefined) || 'client_barge_in';
            logger.info({ deviceId, reason }, 'ESP32 requested audio cancellation (barge-in)');
            if (session.activeSessionId) {
              voiceService.endSession(session.activeSessionId);
              session.activeSessionId = undefined;
            }
            break;
          }

          case 'audio:ready': {
            const sessId = (payload.sessionId as string | undefined) || '';
            const gen = payload.generation as number | undefined;
            logger.info({ deviceId, sessId, gen }, 'ESP32 acknowledged audio session readiness');
            esp32AudioEvents.emit(`ready:${deviceId}:${sessId}`, gen);
            break;
          }

          case 'audio:flow': {
            const status = (payload.status as string | undefined) || 'resume';
            const sessId = (payload.sessionId as string | undefined) || '';
            const gen = payload.generation as number | undefined;
            logger.info({ deviceId, status, sessId, gen }, 'ESP32 audio buffer watermark flow control');
            esp32AudioEvents.emit(`flow:${deviceId}`, status);
            if (sessId) {
              if (status === 'pause') session.pausedPlaybackSessionId = sessId;
              if (status === 'resume' && session.pausedPlaybackSessionId === sessId) {
                session.pausedPlaybackSessionId = undefined;
              }
              esp32AudioEvents.emit(`flow:${deviceId}:${sessId}`, { status, generation: gen });
            }
            break;
          }

          case 'sensor:update': {
            logger.debug({ deviceId, data: payload }, 'ESP32 sensor telemetry update');
            break;
          }

          default:
            logger.debug({ deviceId, event }, 'Unhandled ESP32 text event');
        }
      } catch (parseErr) {
        logger.error({ deviceId, parseErr }, 'Failed to parse ESP32 text frame JSON');
      }
    });

    // 5. Handle Disconnect
    socket.on('close', async (code: number, reason: Buffer) => {
      logger.info({ deviceId, code, reason: reason.toString() }, 'ESP32 WebSocket disconnected');
      if (activeConnections.get(deviceId) !== session) return;
      activeConnections.delete(deviceId);

      // Clean up active voice session if device disconnects mid-conversation
      if (session.activeSessionId) {
        voiceService.endSession(session.activeSessionId);
        session.activeSessionId = undefined;
      }

      await deviceRepository.updateStatus(deviceId, DeviceStatus.OFFLINE);
      await deviceRepository.endSession(deviceId, reason.toString() || `closed_${code}`);

      dashboardBroadcast.emitDeviceStatus(deviceId, userId, {
        deviceId,
        status: DeviceStatus.OFFLINE,
        state: 'idle',
      });
    });

    socket.on('error', (socketErr) => {
      logger.error({ deviceId, socketErr }, 'ESP32 WebSocket error');
    });
  });
}

