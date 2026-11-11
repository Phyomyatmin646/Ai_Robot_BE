import fp from 'fastify-plugin';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { FastifyInstance } from 'fastify';
import { config } from '../config/index.js';

export const swaggerPlugin = fp(async (fastify: FastifyInstance) => {
  await fastify.register(swagger, {
    openapi: {
      info: {
        title: 'AI Voice Assistant Robot Platform API',
        description: `
## AI Voice Assistant Robot Platform Backend API

This backend manages:
- **ESP32-S3 AI Robot Communication** (Native RFC 6455 WebSockets, Binary PCM Audio & JSON Control)
- **Web Dashboard** (Socket.IO for real-time state, touch notifications, and device telemetry)
- **AI Voice Engine** (Gemini Live real-time speech-to-speech, STT/TTS fallback)
- **RAG Knowledge Base** (Document uploads, Vector Search)
- **MCP Tool Integration** (Authorized tool execution registry)
- **Todo & Reminder Scheduling** (BullMQ / Redis background workers, Asia/Yangon timezone)
- **Telegram Notifications** (Bot API alerts & reminders)
- **Audio Library** (MongoDB GridFS streaming playback with range support)
        `,
        version: '1.0.0',
        contact: {
          name: 'AI Robot Platform Architecture Team',
        },
      },
      servers: [
        {
          url: `http://${config.HOST}:${config.PORT}${config.API_PREFIX}`,
          description: 'Current environment API server',
        },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
            description: 'Enter your JWT access token (format: Bearer <token>)',
          },
          deviceKeyAuth: {
            type: 'apiKey',
            name: 'x-device-key',
            in: 'header',
            description: 'Device API Secret Key for physical robot requests',
          },
        },
      },
      tags: [
        { name: 'Health', description: 'System health and readiness checks' },
        { name: 'Auth', description: 'User registration, login, token refresh, and password management' },
        { name: 'Users', description: 'User profile and preferences management' },
        { name: 'Devices', description: 'ESP32-S3 registration, telemetry, control, and settings' },
        { name: 'Voice', description: 'AI Voice configuration, sessions, and latency metrics' },
        { name: 'Conversations', description: 'Conversation sessions and message history' },
        { name: 'Audio', description: 'Audio recordings library, GridFS streaming playback, and downloads' },
        { name: 'Todo', description: 'Task and todo management' },
        { name: 'Reminders', description: 'Scheduled and recurring reminders with timezone support' },
        { name: 'Notifications', description: 'In-app and cross-channel notification preferences' },
        { name: 'Telegram', description: 'Telegram bot integration and user linking' },
        { name: 'Knowledge', description: 'RAG knowledge base, document ingestion, and semantic search' },
        { name: 'MCP', description: 'Model Context Protocol tools and execution logs' },
        { name: 'Settings', description: 'Robot hardware, sound, voice, and display settings' },
        { name: 'Analytics', description: 'System, device, and voice latency analytics' },
      ],
    },
  });

  await fastify.register(swaggerUi, {
    routePrefix: '/api/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
      displayRequestDuration: true,
    },
    staticCSP: true,
    transformStaticCSP: (header) => header,
  });
});

