import { FastifyInstance } from 'fastify';
import { deviceController } from './device.controller.js';
import { authenticate } from '../../middleware/auth.js';
import { z } from 'zod';
import { validate } from '../../middleware/validate.js';
import { DeviceType } from '@ai-robot/shared-types';

const registerDeviceSchema = z.object({
  name: z.string().min(1).max(100),
  deviceType: z.nativeEnum(DeviceType).default(DeviceType.ESP32_S3),
  macAddress: z.string().regex(/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/, 'Invalid MAC address format'),
  firmwareVersion: z.string().default('1.0.0'),
  hardwareVersion: z.string().default('ESP32-S3-WROOM-1'),
  capabilities: z
    .object({
      hasMicrophone: z.boolean().default(true),
      hasSpeaker: z.boolean().default(true),
      hasDisplay: z.boolean().default(true),
      hasTouchSensor: z.boolean().default(true),
      hasLED: z.boolean().default(true),
      hasVolumeButtons: z.boolean().default(true),
      maxSampleRate: z.number().default(48000),
      supportedCodecs: z.array(z.string()).default(['pcm_16bit']),
    })
    .optional(),
});

const updateConfigSchema = z.object({
  volumeLevel: z.number().min(0).max(100).optional(),
  brightnessLevel: z.number().min(0).max(100).optional(),
  ledEnabled: z.boolean().optional(),
  audioChunkSize: z.number().min(512).max(16384).optional(),
  heartbeatInterval: z.number().min(5).max(120).optional(),
});

export async function deviceRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', authenticate);

  fastify.post('/register', {
    schema: {
      tags: ['Devices'],
      summary: 'Register an ESP32-S3 robot device',
      security: [{ bearerAuth: [] }],
    },
    preHandler: [validate({ body: registerDeviceSchema })],
    handler: deviceController.register,
  });

  fastify.get('/', {
    schema: {
      tags: ['Devices'],
      summary: 'List all registered devices for the user',
      security: [{ bearerAuth: [] }],
    },
    handler: deviceController.list,
  });

  fastify.get('/:id', {
    schema: {
      tags: ['Devices'],
      summary: 'Get device details by ID',
      security: [{ bearerAuth: [] }],
    },
    handler: deviceController.getById,
  });

  fastify.patch('/:id/config', {
    schema: {
      tags: ['Devices'],
      summary: 'Update device hardware configuration',
      security: [{ bearerAuth: [] }],
    },
    preHandler: [validate({ body: updateConfigSchema })],
    handler: deviceController.updateConfig,
  });

  fastify.delete('/:id', {
    schema: {
      tags: ['Devices'],
      summary: 'Delete / unregister a device',
      security: [{ bearerAuth: [] }],
    },
    handler: deviceController.delete,
  });
}
