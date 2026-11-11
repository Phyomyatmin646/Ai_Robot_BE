import { FastifyInstance } from 'fastify';
import { settingsController } from './settings.controller.js';
import { authenticate } from '../../middleware/auth.js';

export async function settingsRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', authenticate);

  fastify.get('/user', {
    schema: {
      tags: ['Settings'],
      summary: 'Get user preferences and AI settings',
      security: [{ bearerAuth: [] }],
    },
    handler: settingsController.getUserSettings,
  });

  fastify.patch('/user', {
    schema: {
      tags: ['Settings'],
      summary: 'Update user preferences and AI settings',
      security: [{ bearerAuth: [] }],
    },
    handler: settingsController.updateUserSettings,
  });

  fastify.get('/device/:deviceId', {
    schema: {
      tags: ['Settings'],
      summary: 'Get robot hardware, sound, voice, and display settings',
      security: [{ bearerAuth: [] }],
    },
    handler: settingsController.getDeviceSettings,
  });

  fastify.patch('/device/:deviceId', {
    schema: {
      tags: ['Settings'],
      summary: 'Update robot hardware settings with immediate physical synchronization',
      security: [{ bearerAuth: [] }],
    },
    handler: settingsController.updateDeviceSettings,
  });
}
