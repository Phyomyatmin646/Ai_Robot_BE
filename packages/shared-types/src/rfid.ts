// ============================================
// RFID Educational Learning System Types
// ============================================

export type RfidLanguage = 'my' | 'en' | 'burmese' | 'english';

export type RfidCardCategory =
  | 'fruits'
  | 'animals'
  | 'colors'
  | 'numbers'
  | 'shapes'
  | 'letters'
  | 'everyday_objects'
  | 'science'
  | 'general'
  | string;

export interface RfidCardData {
  /** Contract version, default '1.0' */
  schemaVersion: string;
  /** Unique ID of the physical RFID card (for diagnostics and dedup only) */
  cardUid?: string;
  /** Topic category of the educational card */
  cardType?: string;
  /** Primary language of the card topic: 'my' (Burmese) or 'en' (English) */
  language?: RfidLanguage;
  /** Educational topic title (e.g. 'Apple' or 'ပန်းသီး') */
  title: string;
  /** Category (e.g. 'fruits', 'animals', 'colors') */
  category: string;
  /** Optional summary or description printed on or stored on the card */
  description?: string;
  /** Optional key educational facts */
  facts?: string[];
  /** Optional learning question or prompt */
  learningPrompt?: string;
}

export interface RfidScanPayload {
  cardUid?: string;
  cardData: RfidCardData | string;
}

export interface RfidScanResultEvent {
  scanId: string;
  cardUid?: string;
  title: string;
  category: string;
  language: string;
  status: 'processing' | 'completed' | 'cached' | 'error';
}

export interface RfidLearningStartEvent {
  scanId: string;
  cardUid?: string;
  title: string;
  category: string;
  language: string;
  text: string;
  hasAudio: boolean;
  audioFormat?: string;
  sampleRate?: number;
}

export interface RfidLearningEndEvent {
  scanId: string;
  cardUid?: string;
  durationMs: number;
  totalAudioChunks?: number;
}

export type RfidErrorCode =
  | 'INVALID_CARD_DATA'
  | 'UNSUPPORTED_SCHEMA_VERSION'
  | 'UNKNOWN_CARD_TYPE'
  | 'PAYLOAD_TOO_LARGE'
  | 'DUPLICATE_SCAN'
  | 'AI_GENERATION_FAILED'
  | 'TTS_GENERATION_FAILED'
  | 'DEVICE_UNAUTHORIZED'
  | 'INTERNAL_ERROR';

export interface RfidErrorEvent {
  code: RfidErrorCode;
  message: string;
  cardUid?: string;
}

export interface IRfidLearningLog {
  id: string;
  deviceId: string;
  userId: string;
  cardUid?: string;
  schemaVersion: string;
  cardType: string;
  title: string;
  category: string;
  language: string;
  aiResponseText: string;
  hasAudio: boolean;
  audioId?: string;
  durationMs: number;
  createdAt: Date;
}
