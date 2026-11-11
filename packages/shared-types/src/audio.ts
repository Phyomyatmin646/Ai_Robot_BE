export enum AudioFormat {
  PCM_16BIT = 'pcm_16bit',
  PCM_32BIT = 'pcm_32bit',
  WAV = 'wav',
  MP3 = 'mp3',
  OGG = 'ogg',
  OPUS = 'opus',
  WEBM = 'webm',
}

export enum AudioType {
  USER_INPUT = 'user_input',
  AI_RESPONSE = 'ai_response',
  UPLOADED = 'uploaded',
  SYSTEM = 'system',
}

/** Header sent with each audio chunk for stream reconstruction */
export interface AudioChunkHeader {
  sessionId: string;
  deviceId: string;
  sequenceNumber: number;
  format: AudioFormat;
  sampleRate: number;
  channels: number;
  bitDepth: number;
  timestamp: number;
  isFinal: boolean;
}

export interface AudioChunk extends AudioChunkHeader {
  data: Buffer | Uint8Array;
}

export interface AudioMetadata {
  id: string;
  userId: string;
  deviceId?: string;
  conversationId?: string;
  fileName: string;
  mimeType: string;
  codec: string;
  sampleRate: number;
  channels: number;
  bitDepth: number;
  duration: number;
  fileSize: number;
  audioType: AudioType;
  storageRef: string;
  storageType: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AudioStreamConfig {
  format: AudioFormat;
  sampleRate: number;
  channels: number;
  bitDepth: number;
  chunkSize: number;
  bufferSize: number;
  vadEnabled: boolean;
  vadThreshold: number;
  silenceTimeout: number;
}

export interface AudioStreamEvent {
  type: 'start' | 'chunk' | 'end' | 'cancel' | 'error';
  sessionId: string;
  deviceId: string;
  timestamp: number;
  data?: Uint8Array;
  error?: string;
}

