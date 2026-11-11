export interface UserSettings {
  userId: string;
  language: string;
  timezone: string;
  notifications: NotificationSettings;
  ai: UserAISettings;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationSettings {
  telegramEnabled: boolean;
  telegramChatId?: string;
  emailEnabled: boolean;
  reminderNotifications: boolean;
  todoNotifications: boolean;
  deviceAlerts: boolean;
  dailySummary: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart?: string;
  quietHoursEnd?: string;
}

export interface UserAISettings {
  fastModel: string;
  thinkingModel: string;
  voiceModel: string;
  personality: string;
  systemPrompt?: string;
  responseLanguage: string;
  ragEnabled: boolean;
  mcpEnabled: boolean;
  thinkingLevel: 'fast' | 'balanced' | 'deep';
  temperature: number;
  maxResponseTokens: number;
}

export interface DeviceSettings {
  deviceId: string;
  userId: string;
  voice: VoiceSettings;
  sound: SoundSettings;
  display: DisplaySettings;
  device: DeviceHardwareSettings;
  updatedAt: Date;
}

export interface VoiceSettings {
  provider: string;
  model: string;
  voiceId: string;
  language: string;
  speed: number;
  volume: number;
  responseMode: 'auto' | 'push_to_talk' | 'wake_word';
  wakeWord?: string;
}

export interface SoundSettings {
  masterVolume: number;
  isMuted: boolean;
  outputVolume: number;
  notificationVolume: number;
  feedbackSoundsEnabled: boolean;
}

export interface DisplaySettings {
  brightness: number;
  isOn: boolean;
  sleepTimeoutSeconds: number;
  theme: 'light' | 'dark' | 'auto';
}

export interface DeviceHardwareSettings {
  name: string;
  wifiSSID?: string;
  firmwareAutoUpdate: boolean;
  heartbeatIntervalSeconds: number;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

