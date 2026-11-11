import { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { AppError } from '../shared/errors.js';
import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';

export function errorHandler(
  error: FastifyError | Error,
  request: FastifyRequest,
  reply: FastifyReply
): void {
  const requestId = request.id;

  // Log error
  if (error instanceof AppError && error.statusCode < 500) {
    logger.warn({ err: error, requestId }, `Client Error: ${error.message}`);
  } else {
    logger.error({ err: error, requestId }, `Unhandled Error: ${error.message}`);
  }

  // Handle AppError (custom errors)
  if (error instanceof AppError) {
    reply.status(error.statusCode).send({
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
      timestamp: new Date().toISOString(),
      requestId,
    });
    return;
  }

  // Handle Zod validation errors
  if (error instanceof ZodError) {
    reply.status(400).send({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: { issues: error.issues },
      },
      timestamp: new Date().toISOString(),
      requestId,
    });
    return;
  }

  // Handle Fastify built-in errors
  if ('statusCode' in error && typeof error.statusCode === 'number') {
    reply.status(error.statusCode).send({
      success: false,
      error: {
        code: error.code || 'HTTP_ERROR',
        message: error.message,
      },
      timestamp: new Date().toISOString(),
      requestId,
    });
    return;
  }

  // Fallback 500 internal server error
  reply.status(500).send({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: config.isProd ? 'An unexpected error occurred' : error.message,
      stack: config.isDev ? error.stack : undefined,
    },
    timestamp: new Date().toISOString(),
    requestId,
  });
}
