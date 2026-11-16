import fastify, { FastifyInstance } from 'fastify';
import { config } from './config/index.js';
import { registerPlugins } from './plugins/index.js';
import { errorHandler } from './middleware/error-handler.js';
import { requestLogger } from './middleware/request-logger.js';
import { isDatabaseConnected } from './config/database.js';
import { isRedisConnected } from './config/redis.js';

// Route imports
import { authRoutes } from './modules/auth/auth.routes.js';
import { userRoutes } from './modules/users/user.routes.js';
import { deviceRoutes } from './modules/devices/device.routes.js';
import { voiceRoutes } from './modules/voice/voice.routes.js';
import { conversationRoutes } from './modules/conversations/conversation.routes.js';
import { audioRoutes } from './modules/audio/audio.routes.js';
import { todoRoutes } from './modules/todo/todo.routes.js';
import { reminderRoutes } from './modules/reminders/reminder.routes.js';
import { notificationRoutes } from './modules/notifications/notification.routes.js';
import { knowledgeRoutes } from './modules/knowledge/knowledge.routes.js';
import { mcpRoutes } from './modules/mcp/mcp.routes.js';
import { settingsRoutes } from './modules/settings/settings.routes.js';
import { analyticsRoutes } from './modules/analytics/analytics.routes.js';
import { rfidRoutes } from './modules/rfid/rfid.routes.js';
import { registerEsp32WebSocketRoute } from './websocket/esp32.gateway.js';

export async function buildApp(): Promise<FastifyInstance> {
  const app = fastify({
    logger: false, // Using custom pino logger in requestLogger middleware
    trustProxy: true,
    disableRequestLogging: true,
  });

  // Global error handler
  app.setErrorHandler(errorHandler);

  // Request logging middleware
  app.addHook('onRequest', requestLogger);

  // Register Core Plugins
  await registerPlugins(app);

  // -----------------------------------------------------------------
  // 1. Health, Readiness, and Liveness Probes
  // -----------------------------------------------------------------
  app.get('/health', {
    schema: {
      tags: ['Health'],
      summary: 'System health check and dependencies connectivity status',
    },
    handler: async (_req, reply) => {
      const mongoStatus = isDatabaseConnected();
      const redisStatus = isRedisConnected();
      const isHealthy = mongoStatus;

      const healthData = {
        status: isHealthy ? 'ok' : 'degraded',
        version: '1.0.0',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        services: {
          mongodb: { status: mongoStatus ? 'connected' : 'disconnected' },
          redis: { status: redisStatus ? 'connected' : 'disconnected' },
          voiceEngine: { status: 'ready', mode: config.VOICE_MODE },
        },
      };

      return reply.status(isHealthy ? 200 : 503).send(healthData);
    },
  });

  app.get('/ready', async (_req, reply) => {
    const ready = isDatabaseConnected();
    return reply.status(ready ? 200 : 503).send({ ready });
  });

  app.get('/live', async (_req, reply) => {
    return reply.send({ live: true });
  });

  // -----------------------------------------------------------------
  // 2. Native RFC 6455 WebSocket Gateway for ESP32-S3
  // -----------------------------------------------------------------
  await registerEsp32WebSocketRoute(app);

  // -----------------------------------------------------------------
  // 3. API Routes Registration (/api/v1)
  // -----------------------------------------------------------------
  await app.register(
    async (api) => {
      await api.register(authRoutes, { prefix: '/auth' });
      await api.register(userRoutes, { prefix: '/users' });
      await api.register(deviceRoutes, { prefix: '/devices' });
      await api.register(voiceRoutes, { prefix: '/voice' });
      await api.register(conversationRoutes, { prefix: '/conversations' });
      await api.register(audioRoutes, { prefix: '/audio' });
      await api.register(todoRoutes, { prefix: '/todo' });
      await api.register(reminderRoutes, { prefix: '/reminders' });
      await api.register(notificationRoutes, { prefix: '/notifications' });
      await api.register(knowledgeRoutes, { prefix: '/knowledge' });
      await api.register(mcpRoutes, { prefix: '/mcp' });
      await api.register(settingsRoutes, { prefix: '/settings' });
      await api.register(analyticsRoutes, { prefix: '/analytics' });
      await api.register(rfidRoutes, { prefix: '/rfid' });
    },
    { prefix: config.API_PREFIX }
  );

  return app;
}

