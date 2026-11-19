import fp from 'fastify-plugin';
import cors, { FastifyCorsOptions } from '@fastify/cors';
import { FastifyInstance, FastifyRequest } from 'fastify';
import { config } from '../config/index.js';

export const corsPlugin = fp(async (fastify: FastifyInstance) => {
  const defaultCorsOptions: FastifyCorsOptions = {
    origin: (origin, cb) => {
      // Allow requests with no origin (e.g. mobile apps, curl, ESP32)
      if (!origin) return cb(null, true);

      if (config.isDev) {
        return cb(null, true);
      }

      if (config.corsOriginsList.includes(origin)) {
        return cb(null, true);
      }

      cb(new Error('Not allowed by CORS policy'), false);
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-device-id', 'x-device-key', 'Range'],
    exposedHeaders: ['Content-Range', 'Accept-Ranges', 'Content-Length', 'Content-Type'],
    credentials: true,
    maxAge: 86400,
  };

  await fastify.register(cors, {
    delegator: (req: FastifyRequest, cb) => {
      if (req.url?.startsWith('/ws/esp32')) {
        cb(null, { origin: false });
        return;
      }
      cb(null, defaultCorsOptions);
    },
  });
});
