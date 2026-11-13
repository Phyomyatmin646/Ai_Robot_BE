import { WebSocket } from 'ws';
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

export interface Esp32DeviceSession {
  deviceId: string;
  userId: string;
  socket: WebSocket;
  ipAddress: string;
  activeSessionId?: string;
  currentSequenceNumber: number;
  lastHeartbeat: number;
  state: RobotState;
}

// Global registry of active ESP32 connections
const activeConnections = new Map<string, Esp32DeviceSession>();

export function getActiveEsp32Session(deviceId: string): Esp32DeviceSession | undefined {
  return activeConnections.get(deviceId);
}

export function getAllActiveEsp32Sessions(): Esp32DeviceSession[] {
  return Array.from(activeConnections.values());
}

/**
 * Send an audio chunk as a binary WebSocket frame to the ESP32
 */
export function sendAudioChunkToEsp32(deviceId: string, chunk: Buffer | Uint8Array): boolean {
  const session = activeConnections.get(deviceId);
  if (!session || session.socket.readyState !== WebSocket.OPEN) {
    return false;
  }
  session.socket.send(chunk, { binary: true });
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
  const payload = JSON.stringify({
    event,
    timestamp: Date.now(),
    data,
  });
  session.socket.send(payload, { binary: false });
  return true;
}

/**
 * Send cancel signal to ESP32 for barge-in interruption
 */
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
        await voiceService.handleIncomingAudioChunk(
          deviceId,
          userId,
          session.activeSessionId,
          data,
          session.currentSequenceNumber
        );
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
            logger.info({ deviceId, pad: touchEvent.pad, pressed: touchEvent.pressed }, 'ESP32 touch event received');
            dashboardBroadcast.emitTouchEvent(deviceId, userId, touchEvent);

            // If touch button triggered push-to-talk start/stop
            if (touchEvent.pressed && session.state === 'idle') {
              session.activeSessionId = `voice_${deviceId}_${Date.now()}`;
              session.state = 'listening';
              dashboardBroadcast.emitRobotState(deviceId, userId, 'listening', session.activeSessionId);
            }
            break;
          }

          case 'audio:start': {
            const activeSessionId = (payload.sessionId as string | undefined) || `voice_${deviceId}_${Date.now()}`;
            session.activeSessionId = activeSessionId;
            session.currentSequenceNumber = 0;
            session.state = 'listening';
            dashboardBroadcast.emitRobotState(deviceId, userId, 'listening', activeSessionId);

            await voiceService.startVoiceSession(
              deviceId,
              userId,
              activeSessionId,
              payload.format || AudioFormat.PCM_16BIT,
              payload.sampleRate || 16000
            );
            break;
          }

          case 'audio:end': {
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
      activeConnections.delete(deviceId);

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

