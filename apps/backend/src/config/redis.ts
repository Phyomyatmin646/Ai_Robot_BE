import { Redis } from 'ioredis';
import { logger } from '../utils/logger.js';
import { config } from './index.js';

let redisClient: Redis | null = null;
let isConnected = false;

export function getRedisClient(): Redis {
  if (redisClient) return redisClient;

  redisClient = new Redis({
    host: config.REDIS_HOST,
    port: config.REDIS_PORT,
    password: config.REDIS_PASSWORD || undefined,
    db: config.REDIS_DB,
    retryStrategy: (times) => {
      const delay = Math.min(times * 100, 3000);
      logger.warn(`Redis reconnecting... attempt ${times}, delay ${delay}ms`);
      return delay;
    },
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: true,
  });

  redisClient.on('connect', () => {
    logger.info('Redis connected');
    isConnected = true;
  });

  redisClient.on('error', (err) => {
    logger.error({ err }, 'Redis error');
    isConnected = false;
  });

  redisClient.on('close', () => {
    logger.warn('Redis connection closed');
    isConnected = false;
  });

  return redisClient;
}

export async function connectRedis(): Promise<Redis> {
  const client = getRedisClient();
  if (!isConnected) {
    await client.connect();
  }
  return client;
}

export async function disconnectRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    isConnected = false;
    logger.info('Redis disconnected cleanly');
  }
}

export function isRedisConnected(): boolean {
  return isConnected && redisClient?.status === 'ready';
}
