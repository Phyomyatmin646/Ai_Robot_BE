import { FastifyInstance } from 'fastify';
import { authController } from './auth.controller.js';
import { authenticate } from '../../middleware/auth.js';
import { z } from 'zod';
import { validate } from '../../middleware/validate.js';

const registerSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  language: z.string().optional(),
  timezone: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
});

export async function authRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post('/register', {
    schema: {
      tags: ['Auth'],
      summary: 'Register a new user account',
      body: {
        type: 'object',
        required: ['name', 'email', 'password'],
        properties: {
          name: { type: 'string' },
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 8 },
          language: { type: 'string' },
          timezone: { type: 'string' },
        },
      },
    },
    preHandler: [validate({ body: registerSchema })],
    handler: authController.register,
  });

  fastify.post('/login', {
    schema: {
      tags: ['Auth'],
      summary: 'User login with email and password',
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string' },
        },
      },
    },
    preHandler: [validate({ body: loginSchema })],
    handler: authController.login,
  });

  fastify.post('/refresh', {
    schema: {
      tags: ['Auth'],
      summary: 'Rotate and refresh JWT access token',
      body: {
        type: 'object',
        required: ['refreshToken'],
        properties: {
          refreshToken: { type: 'string' },
        },
      },
    },
    preHandler: [validate({ body: refreshSchema })],
    handler: authController.refreshToken,
  });

  fastify.post('/logout', {
    schema: {
      tags: ['Auth'],
      summary: 'User logout and refresh token invalidation',
      security: [{ bearerAuth: [] }],
    },
    preHandler: [authenticate],
    handler: authController.logout,
  });

  fastify.post('/change-password', {
    schema: {
      tags: ['Auth'],
      summary: 'Change current user password',
      security: [{ bearerAuth: [] }],
    },
    preHandler: [authenticate, validate({ body: changePasswordSchema })],
    handler: authController.changePassword,
  });
}
