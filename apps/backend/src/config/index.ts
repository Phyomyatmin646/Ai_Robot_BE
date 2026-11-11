import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default('0.0.0.0'),
  API_PREFIX: z.string().default('/api/v1'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  // MongoDB
  MONGODB_URI: z.string().default('mongodb://localhost:27017/ai-robot'),
  MONGODB_DB_NAME: z.string().default('ai-robot'),

  // Redis
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().optional().default(''),
  REDIS_DB: z.coerce.number().default(0),

  // JWT
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters').default('development-jwt-secret-do-not-use-in-production-123'),
  JWT_ACCESS_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_EXPIRY: z.string().default('7d'),

  // AI Providers
  GEMINI_API_KEY: z.string().optional().default(''),
  OPENAI_API_KEY: z.string().optional().default(''),
  ELEVENLABS_API_KEY: z.string().optional().default(''),

  // AI Models
  FAST_MODEL: z.string().default('gemini-2.0-flash'),
  THINKING_MODEL: z.string().default('gemini-2.0-pro'),
  VOICE_MODEL: z.string().default('gemini-2.0-flash-live'),

  // Voice
  VOICE_MODE: z.enum(['native', 'cascade']).default('native'),
  DEFAULT_LANGUAGE: z.string().default('en'),
  SUPPORTED_LANGUAGES: z.string().default('en,my'),

  // MQTT
  MQTT_PORT: z.coerce.number().default(1883),
  MQTT_HOST: z.string().default('localhost'),
  MQTT_USERNAME: z.string().optional().default(''),
  MQTT_PASSWORD: z.string().optional().default(''),

  // Telegram
  TELEGRAM_BOT_TOKEN: z.string().optional().default(''),

  // Audio
  AUDIO_SAMPLE_RATE: z.coerce.number().default(16000),
  AUDIO_CHANNELS: z.coerce.number().default(1),
  AUDIO_BIT_DEPTH: z.coerce.number().default(16),
  AUDIO_CHUNK_SIZE: z.coerce.number().default(4096),
  MAX_AUDIO_FILE_SIZE: z.coerce.number().default(52428800), // 50MB
  AUDIO_STORAGE_TYPE: z.enum(['gridfs', 's3']).default('gridfs'),

  // Timezone
  DEFAULT_TIMEZONE: z.string().default('Asia/Yangon'),

  // CORS
  CORS_ORIGINS: z.string().default('http://localhost:3001,http://localhost:5173'),

  // Rate Limiting
  RATE_LIMIT_MAX: z.coerce.number().default(100),
  RATE_LIMIT_WINDOW: z.coerce.number().default(60000),

  // AI Microservice
  AI_SERVICE_URL: z.string().default('http://localhost:8000'),
  AI_SERVICE_TIMEOUT: z.coerce.number().default(30000),

  // Ollama
  OLLAMA_BASE_URL: z.string().default('http://localhost:11434'),
  OLLAMA_ENABLED: z.string().transform((v) => v === 'true').default('false'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.format());
  process.exit(1);
}

export const config = {
  ...parsed.data,
  isDev: parsed.data.NODE_ENV === 'development',
  isProd: parsed.data.NODE_ENV === 'production',
  isTest: parsed.data.NODE_ENV === 'test',
  corsOriginsList: parsed.data.CORS_ORIGINS.split(',').map((s) => s.trim()),
  supportedLanguagesList: parsed.data.SUPPORTED_LANGUAGES.split(',').map((s) => s.trim()),
} as const;

export type Config = typeof config;
