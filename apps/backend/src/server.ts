import { buildApp } from './app.js';
import { config } from './config/index.js';
import { logger } from './utils/logger.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { connectRedis, disconnectRedis } from './config/redis.js';
import { initializeDashboardSocketIO } from './websocket/dashboard.gateway.js';
import { startMqttBroker, stopMqttBroker } from './mqtt/broker.js';
import { startReminderWorker } from './jobs/reminder.worker.js';
import type { Worker } from 'bullmq';

let reminderWorker: Worker | null = null;

async function bootstrap() {
  logger.info(`Starting AI Voice Assistant Robot Platform backend in [${config.NODE_ENV}] mode...`);

  // 1. Connect MongoDB
  try {
    await connectDatabase();
  } catch (err) {
    logger.warn('Initial MongoDB connection deferred. Server will start in degraded mode.');
  }

  // 2. Connect Redis
  try {
    await connectRedis();
    reminderWorker = startReminderWorker();
  } catch (err) {
    logger.warn('Initial Redis connection deferred. Background jobs queue unavailable.');
  }

  // 3. Start MQTT Broker
  try {
    await startMqttBroker();
  } catch (err) {
    logger.warn({ err }, 'Failed to start MQTT broker. MQTT communications unavailable.');
  }

  // 4. Build Fastify application
  const app = await buildApp();

  // 5. Initialize Socket.IO on the raw HTTP server (for Web Dashboard)
  initializeDashboardSocketIO(app.server, app);

  // 6. Listen for incoming HTTP & WebSocket connections
  try {
    await app.listen({ port: config.PORT, host: config.HOST });
    logger.info(`🚀 Fastify HTTP & WebSocket server listening at http://${config.HOST}:${config.PORT}`);
    logger.info(`📖 Swagger API Docs accessible at http://${config.HOST}:${config.PORT}/api/docs`);
    logger.info(`🤖 ESP32 Native WebSocket endpoint: ws://${config.HOST}:${config.PORT}/ws/esp32`);
    logger.info(`📊 Web Dashboard Socket.IO endpoint: ws://${config.HOST}:${config.PORT}/socket.io/`);
  } catch (err) {
    logger.fatal({ err }, 'Error starting server');
    process.exit(1);
  }

  // -------------------------------------------------------------
  // Graceful Shutdown
  // -------------------------------------------------------------
  const gracefulShutdown = async (signal: string) => {
    logger.info(`Received ${signal}. Starting graceful shutdown...`);

    try {
      if (reminderWorker) {
        await reminderWorker.close();
      }
      await app.close();
      await stopMqttBroker();
      await disconnectRedis();
      await disconnectDatabase();
      logger.info('Graceful shutdown completed successfully');
      process.exit(0);
    } catch (err) {
      logger.error({ err }, 'Error during graceful shutdown');
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  process.on('unhandledRejection', (reason, promise) => {
    logger.error({ reason, promise }, 'Unhandled Rejection at Promise');
  });

  process.on('uncaughtException', (err) => {
    logger.fatal({ err }, 'Uncaught Exception thrown');
    process.exit(1);
  });
}

bootstrap().catch((err) => {
  logger.fatal({ err }, 'Fatal bootstrap error');
  process.exit(1);
});
