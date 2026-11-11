import { FastifyRequest, FastifyReply } from 'fastify';
import { logger } from '../utils/logger.js';

export function requestLogger(request: FastifyRequest, reply: FastifyReply, done: () => void): void {
  const startTime = Date.now();
  const { method, url, ip } = request;

  reply.raw.on('finish', () => {
    const duration = Date.now() - startTime;
    const statusCode = reply.statusCode;

    const logData = {
      requestId: request.id,
      method,
      url,
      ip,
      statusCode,
      durationMs: duration,
    };

    if (statusCode >= 500) {
      logger.error(logData, `${method} ${url} ${statusCode} - ${duration}ms`);
    } else if (statusCode >= 400) {
      logger.warn(logData, `${method} ${url} ${statusCode} - ${duration}ms`);
    } else {
      logger.info(logData, `${method} ${url} ${statusCode} - ${duration}ms`);
    }
  });

  done();
}
