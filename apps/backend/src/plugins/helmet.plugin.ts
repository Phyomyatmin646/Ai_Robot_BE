import fp from 'fastify-plugin';
import helmet from '@fastify/helmet';
import { FastifyInstance } from 'fastify';
import { config } from '../config/index.js';

export const helmetPlugin = fp(async (fastify: FastifyInstance) => {
  await fastify.register(helmet, {
    contentSecurityPolicy: config.isProd
      ? {
          directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", 'data:', 'validator.swagger.io'],
          },
        }
      : false, // Disabled in development for Swagger UI convenience
    crossOriginEmbedderPolicy: false,
  });
});

