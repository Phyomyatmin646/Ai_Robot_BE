/** Base interface for all AI providers */
export interface AIProvider {
  name: string;
  type: AIProviderType;
  isAvailable(): Promise<boolean>;
  getModels(): Promise<AIModel[]>;
}

export enum AIProviderType {
  GEMINI = 'gemini',
  OPENAI = 'openai',
  ELEVENLABS = 'elevenlabs',
  OLLAMA = 'ollama',
}

export interface AIModel {
  id: string;
  name: string;
  provider: AIProviderType;
  capabilities: ModelCapability[];
  maxTokens: number;
  supportsStreaming: boolean;
  supportsVision: boolean;
}

export enum ModelCapability {
  TEXT_GENERATION = 'text_generation',
  VOICE_CHAT = 'voice_chat',
  STT = 'stt',
  TTS = 'tts',
  EMBEDDING = 'embedding',
  REASONING = 'reasoning',
  VISION = 'vision',
}

export interface VoiceProvider extends AIProvider {
  startSession(config: VoiceSessionConfig): Promise<string>;
  sendAudio(sessionId: string, chunk: Uint8Array): Promise<void>;
  receiveAudio(sessionId: string): AsyncGenerator<Uint8Array>;
  endSession(sessionId: string): Promise<void>;
}

export interface STTProvider extends AIProvider {
  transcribe(audio: Uint8Array, config: STTConfig): Promise<TranscriptionResult>;
  transcribeStream(config: STTConfig): TranscribeStreamHandler;
}

export interface TTSProvider extends AIProvider {
  synthesize(text: string, config: TTSConfig): Promise<Uint8Array>;
  synthesizeStream(text: string, config: TTSConfig): AsyncGenerator<Uint8Array>;
}

export interface EmbeddingProvider extends AIProvider {
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
  getDimension(): number;
}

export interface VoiceSessionConfig {
  model: string;
  language: string;
  systemPrompt: string;
  voiceId?: string;
  sampleRate: number;
  enableVAD: boolean;
  enableInterruption: boolean;
}

export interface STTConfig {
  language: string;
  model?: string;
  sampleRate: number;
  encoding: string;
  interimResults?: boolean;
}

export interface TTSConfig {
  voice: string;
  language: string;
  speed: number;
  sampleRate: number;
  encoding: string;
}

export interface TranscriptionResult {
  text: string;
  confidence: number;
  language: string;
  words?: TranscriptionWord[];
  isFinal: boolean;
}

export interface TranscriptionWord {
  word: string;
  startTime: number;
  endTime: number;
  confidence: number;
}

export interface TranscribeStreamHandler {
  write(chunk: Uint8Array): void;
  onResult(callback: (result: TranscriptionResult) => void): void;
  close(): Promise<TranscriptionResult>;
}

export interface AIConfig {
  fastModel: string;
  thinkingModel: string;
  voiceModel: string;
  voiceMode: 'native' | 'cascade';
  defaultLanguage: string;
  supportedLanguages: string[];
  maxContextTokens: number;
  temperature: number;
  maxResponseTokens: number;
}

export enum VoiceMode {
  NATIVE = 'native',
  CASCADE = 'cascade',
}

/** Latency tracking for voice pipeline performance */
export interface LatencyMetrics {
  audioCaptureStart: number;
  firstAudioUpload: number;
  speechDetected: number;
  aiRequestStart: number;
  firstAiResponse: number;
  firstAudioResponse: number;
  playbackStart: number;
  totalDuration: number;
}

