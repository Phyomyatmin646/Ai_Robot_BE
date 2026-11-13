import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HttpServer } from 'node:http';
import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';
import type { FastifyInstance } from 'fastify';
import { RobotState, TouchSensorEvent, DeviceStatusEvent, DeviceHeartbeatEvent, SocketRooms } from '@ai-robot/shared-types';

let io: SocketIOServer | null = null;

export function initializeDashboardSocketIO(server: HttpServer, fastify: FastifyInstance): SocketIOServer {
  io = new SocketIOServer(server, {
    cors: {
      origin: config.corsOriginsList,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingInterval: 10000,
    pingTimeout: 5000,
    transports: ['websocket', 'polling'],
  });

  // Socket.IO authentication middleware using Fastify JWT
  io.use(async (socket: Socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        return next(new Error('Authentication token required'));
      }

      const decoded = fastify.jwt.verify<{ userId: string; email: string; role: string }>(token);
      socket.data.user = decoded;
      next();
    } catch (err) {
      logger.warn({ err }, 'Dashboard Socket.IO authentication failed');
      next(new Error('Invalid or expired authentication token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const user = socket.data.user;
    logger.info({ userId: user?.userId, socketId: socket.id }, 'Dashboard client connected via Socket.IO');

    // Automatically join user-specific room
    if (user?.userId) {
      socket.join(SocketRooms.user(user.userId));
    }

    // Client can subscribe to specific device updates
    socket.on('device:subscribe', (deviceId: string) => {
      socket.join(SocketRooms.device(deviceId));
      logger.debug({ socketId: socket.id, deviceId }, 'Subscribed to device room');
    });

    socket.on('device:unsubscribe', (deviceId: string) => {
      socket.leave(SocketRooms.device(deviceId));
      logger.debug({ socketId: socket.id, deviceId }, 'Unsubscribed from device room');
    });

    // Client can subscribe to conversation updates
    socket.on('conversation:subscribe', (conversationId: string) => {
      socket.join(SocketRooms.conversation(conversationId));
    });

    socket.on('disconnect', (reason) => {
      logger.info({ socketId: socket.id, reason }, 'Dashboard client disconnected');
    });
  });

  logger.info('Dashboard Socket.IO gateway initialized');
  return io;
}

export function getDashboardSocketIO(): SocketIOServer {
  if (!io) {
    throw new Error('Socket.IO has not been initialized yet');
  }
  return io;
}

/** Broadcast helper functions for Web Dashboard */
export const dashboardBroadcast = {
  /** Get underlying Socket.IO server instance if initialized */
  getDashboardSocketIO(): SocketIOServer | null {
    return io;
  },

  /** Emit robot state change (idle, listening, thinking, speaking) */
  emitRobotState(deviceId: string, userId: string, state: RobotState, sessionId?: string): void {
    if (!io) return;
    const payload = { deviceId, state, sessionId, timestamp: Date.now() };
    io.to(SocketRooms.device(deviceId)).emit('robot:state', payload);
    io.to(SocketRooms.user(userId)).emit('robot:state', payload);
  },

  /** Emit device online/offline status */
  emitDeviceStatus(deviceId: string, userId: string, event: DeviceStatusEvent): void {
    if (!io) return;
    io.to(SocketRooms.device(deviceId)).emit('device:status', event);
    io.to(SocketRooms.user(userId)).emit('device:status', event);
  },

  /** Emit device heartbeat telemetry */
  emitDeviceHeartbeat(deviceId: string, userId: string, event: DeviceHeartbeatEvent): void {
    if (!io) return;
    io.to(SocketRooms.device(deviceId)).emit('device:heartbeat', event);
    io.to(SocketRooms.user(userId)).emit('device:heartbeat', event);
  },

  /** Emit touch sensor event to dashboard */
  emitTouchEvent(deviceId: string, userId: string, event: TouchSensorEvent): void {
    if (!io) return;
    io.to(SocketRooms.device(deviceId)).emit('robot:touch', event);
    io.to(SocketRooms.user(userId)).emit('robot:touch', event);
  },

  /** Emit real-time transcription update */
  emitTranscription(
    userId: string,
    sessionId: string,
    text: string,
    isFinal: boolean,
    speaker: 'user' | 'assistant'
  ): void {
    if (!io) return;
    io.to(SocketRooms.user(userId)).emit('audio:transcription', { sessionId, text, isFinal, speaker });
  },

  /** Emit new conversation message */
  emitConversationMessage(userId: string, conversationId: string, message: unknown): void {
    if (!io) return;
    io.to(SocketRooms.conversation(conversationId)).emit('conversation:message', { conversationId, message });
    io.to(SocketRooms.user(userId)).emit('conversation:message', { conversationId, message });
  },

  /** Emit in-app notification */
  emitNotification(userId: string, notification: unknown): void {
    if (!io) return;
    io.to(SocketRooms.user(userId)).emit('notification:new', notification);
  },

  /** Emit reminder triggered alert */
  emitReminderAlert(userId: string, reminderId: string, title: string): void {
    if (!io) return;
    io.to(SocketRooms.user(userId)).emit('reminder:triggered', { reminderId, title });
  },
};

