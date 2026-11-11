export enum DeviceType {
  ESP32_S3 = 'esp32-s3',
  SIMULATOR = 'simulator',
}

export enum DeviceStatus {
  ONLINE = 'online',
  OFFLINE = 'offline',
  UPDATING = 'updating',
  ERROR = 'error',
}

export enum ConnectionType {
  WEBSOCKET = 'websocket',
  MQTT = 'mqtt',
  HTTP = 'http',
}

export interface Device {
  id: string;
  userId: string;
  name: string;
  deviceType: DeviceType;
  status: DeviceStatus;
  firmwareVersion: string;
  hardwareVersion: string;
  macAddress: string;
  ipAddress?: string;
  lastSeen?: Date;
  isRegistered: boolean;
  config: DeviceConfig;
  capabilities: DeviceCapabilities;
  createdAt: Date;
  updatedAt: Date;
}

export interface DeviceConfig {
  wifiSSID?: string;
  audioSampleRate: number;
  audioChannels: number;
  audioBitDepth: number;
  audioChunkSize: number;
  audioCodec: string;
  volumeLevel: number;
  brightnessLevel: number;
  ledEnabled: boolean;
  sleepTimeout: number;
  heartbeatInterval: number;
}

export interface DeviceCapabilities {
  hasMicrophone: boolean;
  hasSpeaker: boolean;
  hasDisplay: boolean;
  hasTouchSensor: boolean;
  hasLED: boolean;
  hasVolumeButtons: boolean;
  maxSampleRate: number;
  supportedCodecs: string[];
}

export interface DeviceRegistrationRequest {
  name: string;
  deviceType: DeviceType;
  macAddress: string;
  firmwareVersion: string;
  hardwareVersion: string;
  capabilities: DeviceCapabilities;
}

export interface DeviceHeartbeat {
  deviceId: string;
  timestamp: number;
  freeHeap: number;
  uptimeSeconds: number;
  wifiRSSI: number;
  cpuTemp?: number;
  batteryLevel?: number;
}

export interface SensorData {
  deviceId: string;
  timestamp: number;
  temperature?: number;
  humidity?: number;
  lightLevel?: number;
  touchState?: boolean;
  volumeButtonState?: 'up' | 'down' | 'none';
  customData?: Record<string, unknown>;
}

export interface DeviceCommand {
  commandId: string;
  deviceId: string;
  type: DeviceCommandType;
  payload: Record<string, unknown>;
  timestamp: number;
  acknowledged: boolean;
}

export enum DeviceCommandType {
  SET_VOLUME = 'set_volume',
  SET_BRIGHTNESS = 'set_brightness',
  SET_LED = 'set_led',
  RESTART = 'restart',
  UPDATE_CONFIG = 'update_config',
  UPDATE_FIRMWARE = 'update_firmware',
  PLAY_AUDIO = 'play_audio',
  STOP_AUDIO = 'stop_audio',
}

