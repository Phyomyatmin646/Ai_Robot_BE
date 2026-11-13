import '@fastify/jwt';
import type { TokenPayload } from '@ai-robot/shared-types';

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: TokenPayload;
    user: TokenPayload;
  }
}

