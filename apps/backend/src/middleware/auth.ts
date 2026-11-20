import { FastifyRequest, FastifyReply } from 'fastify';
import { UnauthorizedError, ForbiddenError } from '../shared/errors.js';
import type { TokenPayload, UserRole } from '@ai-robot/shared-types';

/**
 * Authentication decorator for Fastify
 * Verifies the JWT Bearer token on requests
 */
export async function authenticate(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  try {
    let authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      const queryToken = (request.query as any)?.token;
      if (queryToken) {
        authHeader = `Bearer ${queryToken}`;
        request.headers.authorization = authHeader;
      } else {
        throw new UnauthorizedError('Missing or invalid Authorization header');
      }
    }

    const decoded = await request.jwtVerify<TokenPayload>();
    request.user = decoded;
  } catch (err: unknown) {
    if (err instanceof UnauthorizedError) throw err;
    throw new UnauthorizedError('Invalid or expired authentication token');
  }
}

/**
 * Role-based authorization middleware
 */
export function authorize(...allowedRoles: UserRole[]) {
  return async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    if (!request.user) {
      throw new UnauthorizedError('User is not authenticated');
    }

    if (!allowedRoles.includes(request.user.role)) {
      throw new ForbiddenError('You do not have permission to perform this action');
    }
  };
}

/**
 * Device-specific authentication middleware
 * Validates device API token from headers
 */
export async function authenticateDevice(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  const apiKey = request.headers['x-device-key'] as string;
  const deviceId = request.headers['x-device-id'] as string;

  if (!apiKey || !deviceId) {
    throw new UnauthorizedError('Missing device authentication headers (x-device-id, x-device-key)');
  }
}

