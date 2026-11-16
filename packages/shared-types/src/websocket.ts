import type { DeviceCapabilities, DeviceStatus, SensorData, DeviceCommandType } from './device.js';
import type { AudioFormat } from './audio.js';
import type { DeviceSettings } from './settings.js';
import type { DeviceConfig } from './device.js';
import type { Message } from './conversation.js';
import type { Notification } from './notification.js';
import type { LatencyMetrics } from './ai.js';
import type {
  RfidScanPayload,
  RfidScanResultEvent,
  RfidLearningStartEvent,
  RfidLearningEndEvent,
  RfidErrorEvent,
} from './rfid.js';

export type {
  RfidScanPayload,
  RfidScanResultEvent,
  RfidLearningStartEvent,
  RfidLearningEndEvent,
  RfidErrorEvent,
};

// ============================================
// Robot Real-Time States
// ============================================

export type RobotState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'error';

// ============================================
// ESP32 Native WebSocket Protocol (RFC 6455)
// ============================================

/** Message wrapper for ESP32 text frames (JSON) */
export interface Esp32WsMessage<T = unknown> {
  event: string;
  deviceId: string;
  sessionId?: string;
  timestamp: number;
  data: T;
}

export interface DeviceConnectEvent {
  deviceId: string;
  firmwareVersion: string;
  hardwareVersion: string;
  macAddress: string;
  capabilities: DeviceCapabilities;
}

export interface DeviceHeartbeatEvent {
  deviceId: string;
  timestamp: number;
  freeHeap: number;
  uptimeSeconds: number;
  wifiRSSI: number;
  cpuTemp?: number;
  batteryLevel?: number;
}

export interface AudioStartEvent {
  sessionId: string;
  deviceId: string;
  format: AudioFormat;
  sampleRate: number;
  channels: number;
  bitDepth: number;
}

export interface AudioChunkEvent {
  sessionId: string;
  deviceId: string;
  sequenceNumber: number;
  timestamp: number;
  isFinal: boolean;
}

export interface AudioEndEvent {
  sessionId: string;
  deviceId: string;
  totalChunks: number;
  totalDuration: number;
}

export interface TouchSensorEvent {
  deviceId: string;
  pad: number;
  pressed: boolean;
  timestamp: number;
}

export interface SensorUpdateEvent {
  deviceId: string;
  data: SensorData;
}

export interface DeviceStatusEvent {
  deviceId: string;
  status: DeviceStatus;
  state?: RobotState;
  error?: string;
}

// ============================================
// Backend → ESP32 Native WebSocket Events
// ============================================

export interface AudioResponseStartEvent {
  sessionId: string;
  format: AudioFormat;
  sampleRate: number;
  channels: number;
  bitDepth?: number;
  totalChunks?: number;
}

export interface AudioResponseChunkHeader {
  sessionId: string;
  sequenceNumber: number;
  timestamp: number;
  isFinal: boolean;
}

export interface AudioResponseEndEvent {
  sessionId: string;
  totalChunks: number;
  totalDuration: number;
}

export interface AudioCancelEvent {
  sessionId: string;
  reason: 'interruption' | 'timeout' | 'error' | 'user_cancel';
}

export interface RobotCommandEvent {
  commandId: string;
  type: DeviceCommandType;
  payload: Record<string, unknown>;
  timestamp: number;
}

export interface RobotStateChangeEvent {
  state: RobotState;
  sessionId?: string;
  timestamp: number;
}

export interface RobotSettingsUpdateEvent {
  settings: Partial<DeviceSettings>;
  timestamp: number;
}

export interface DeviceConfigUpdateEvent {
  config: Partial<DeviceConfig>;
  timestamp: number;
}

// ============================================
// Web Dashboard ↔ Socket.IO Events
// ============================================

export interface DashboardEvents {
  'device:status': DeviceStatusEvent;
  'device:heartbeat': DeviceHeartbeatEvent;
  'robot:state': { deviceId: string; state: RobotState; sessionId?: string; timestamp: number };
  'robot:touch': TouchSensorEvent;
  'rfid:scan': { deviceId: string; scanId: string; cardUid?: string; title: string; category: string; timestamp: number };
  'rfid:result': { deviceId: string; result: RfidLearningStartEvent };
  'conversation:message': { conversationId: string; message: Message };
  'notification:new': Notification;
  'reminder:triggered': { reminderId: string; title: string };
  'audio:transcription': { sessionId: string; text: string; isFinal: boolean; speaker: 'user' | 'assistant' };
  'settings:updated': { deviceId: string; settings: Partial<DeviceSettings> };
  'latency:metrics': LatencyMetrics;
}

// ============================================
// Socket.IO Room naming conventions
// ============================================

export const SocketRooms = {
  user: (userId: string) => `user:${userId}`,
  device: (deviceId: string) => `device:${deviceId}`,
  conversation: (conversationId: string) => `conversation:${conversationId}`,
  admin: () => 'admin',
} as const;
