import fp from 'fastify-plugin';
import rateLimit from '@fastify/rate-limit';
import { FastifyInstance } from 'fastify';
import { config } from '../config/index.js';
import { getRedisClient } from '../config/redis.js';

export const rateLimitPlugin = fp(async (fastify: FastifyInstance) => {
  try {
    const redis = getRedisClient();
    await fastify.register(rateLimit, {
      max: config.RATE_LIMIT_MAX,
      timeWindow: config.RATE_LIMIT_WINDOW,
      redis,
      keyGenerator: (request) => {
        return (
          (request.headers['x-device-id'] as string) ||
          (request.headers['x-forwarded-for'] as string) ||
          request.ip
        );
      },
      errorResponseBuilder: (_req, context) => ({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: `Too many requests. Please try again after ${Math.ceil(context.ttl / 1000)} seconds.`,
        },
        timestamp: new Date().toISOString(),
      }),
    });
  } catch {
    // In-memory fallback if Redis is not yet connected
    await fastify.register(rateLimit, {
      max: config.RATE_LIMIT_MAX,
      timeWindow: config.RATE_LIMIT_WINDOW,
    });
  }
});

