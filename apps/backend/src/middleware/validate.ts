import { FastifyRequest, FastifyReply } from 'fastify';
import { z, ZodSchema } from 'zod';
import { ValidationError } from '../shared/errors.js';

export interface ValidationSchemas {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
  headers?: ZodSchema;
}

export function validate(schemas: ValidationSchemas) {
  return async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    try {
      if (schemas.body && request.body !== undefined) {
        request.body = schemas.body.parse(request.body);
      }
      if (schemas.query && request.query !== undefined) {
        request.query = schemas.query.parse(request.query);
      }
      if (schemas.params && request.params !== undefined) {
        request.params = schemas.params.parse(request.params);
      }
      if (schemas.headers && request.headers !== undefined) {
        request.headers = schemas.headers.parse(request.headers);
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError('Validation failed', {
          issues: error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
            code: issue.code,
          })),
        });
      }
      throw error;
    }
  };
}
