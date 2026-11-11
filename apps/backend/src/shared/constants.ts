export const APP_CONSTANTS = {
  PAGINATION: {
    DEFAULT_PAGE: 1,
    DEFAULT_LIMIT: 20,
    MAX_LIMIT: 100,
  },
  AUDIO: {
    DEFAULT_SAMPLE_RATE: 16000,
    DEFAULT_CHANNELS: 1,
    DEFAULT_BIT_DEPTH: 16,
    DEFAULT_CHUNK_SIZE: 4096,
    MAX_FILE_SIZE: 50 * 1024 * 1024, // 50MB
    SUPPORTED_CODECS: ['pcm', 'wav', 'mp3', 'opus'],
  },
  DEVICE: {
    HEARTBEAT_TIMEOUT_MS: 30000,
    OFFLINE_THRESHOLD_MS: 60000,
    DEFAULT_VOLUME: 80,
    DEFAULT_BRIGHTNESS: 80,
  },
  AUTH: {
    PASSWORD_MIN_LENGTH: 8,
    MAX_LOGIN_ATTEMPTS: 5,
    LOCKOUT_TIME_MS: 15 * 60 * 1000, // 15 mins
  },
  TIMEZONE: {
    DEFAULT: 'Asia/Yangon',
  },
  REDIS_KEYS: {
    DEVICE_STATUS: (id: string) => `device:status:${id}`,
    DEVICE_SESSION: (id: string) => `device:session:${id}`,
    USER_SESSION: (id: string) => `user:session:${id}`,
    RATE_LIMIT: (ip: string) => `ratelimit:${ip}`,
  },
  BULL_QUEUES: {
    REMINDERS: 'reminder-queue',
    NOTIFICATIONS: 'notification-queue',
    AUDIO_PROCESSING: 'audio-processing-queue',
  },
} as const;
