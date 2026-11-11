import { FastifyInstance } from 'fastify';
import multipart from '@fastify/multipart';
import fastifyWebsocket from '@fastify/websocket';
import { helmetPlugin } from './helmet.plugin.js';
import { corsPlugin } from './cors.plugin.js';
import { jwtPlugin } from './jwt.plugin.js';
import { rateLimitPlugin } from './rate-limit.plugin.js';
import { swaggerPlugin } from './swagger.plugin.js';
import { config } from '../config/index.js';

export async function registerPlugins(fastify: FastifyInstance): Promise<void> {
  // 1. Security Headers
  await fastify.register(helmetPlugin);

  // 2. CORS
  await fastify.register(corsPlugin);

  // 3. Rate Limiting
  await fastify.register(rateLimitPlugin);

  // 4. JWT Authentication
  await fastify.register(jwtPlugin);

  // 5. Multipart File Uploads
  await fastify.register(multipart, {
    limits: {
      fileSize: config.MAX_AUDIO_FILE_SIZE,
      files: 5,
    },
  });

  // 6. Native RFC 6455 WebSocket Support (for ESP32-S3 direct communication)
  await fastify.register(fastifyWebsocket, {
    options: {
      maxPayload: 10 * 1024 * 1024, // 10MB max binary frame
    },
  });

  // 7. OpenAPI / Swagger Documentation
  await fastify.register(swaggerPlugin);
}
