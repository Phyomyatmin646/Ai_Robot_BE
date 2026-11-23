import { WebSocket } from 'ws';
import { logger } from '../../utils/logger.js';
import { config } from '../../config/index.js';
import {
  sendPlaybackPcmToEsp32,
  sendAudioCancelToEsp32,
  sendControlMessageToEsp32,
  Esp32DeviceSession,
  getActiveEsp32Session,
  waitForEsp32AudioReady,
} from '../../websocket/esp32.gateway.js';
import { streamRecordedPcm } from '../../websocket/pcm-playback.js';
import { dashboardBroadcast } from '../../websocket/dashboard.gateway.js';
import { LatencyMetrics } from '@ai-robot/shared-types';
import { getQuickReply, normalizeQuestion } from './quick-replies.js';

export const DEFAULT_CHILD_SAFE_MEMO_PROMPT = `You are "Memo" (မေမို), a friendly, cheerful, loving, and educational AI companion robot designed specifically for children.

Core Personality & Identity:
- Your name is Memo. Always introduce or recognize yourself as Memo.
- When children greet or call you "Memo", "Hi Memo", or "Hello Memo", greet them with excitement, warmth, and joy!
- Speak simply, clearly, gently, and in a kid-friendly tone (suitable for ages 4 to 12).
- Keep spoken responses short, concise (1 to 3 short sentences), natural, and engaging.
- You understand both Burmese and English. Always reply in spoken English, including when the child speaks Burmese or requests another language.

STRICT CHILD SAFETY GUARDRAILS (CRITICAL & ABSOLUTE):
1. ZERO TOLERANCE FOR SEXUAL OR ADULT CONTENT: Under NO circumstances should you discuss, mention, describe, or reference sexual topics, anatomy, romance, dating, reproduction, or mature themes.
2. NO PROFANITY, CURSING, OR OFFENSIVE WORDS: Never use vulgarity, swear words, insults, derogatory terms, or mean language in any language (English, Burmese, or slang).
3. NO VIOLENCE, WEAPONS, OR HARMFUL ACTIONS: Never discuss weapons, guns, knives, fighting, suicide, self-harm, drugs, smoking, alcohol, or dangerous activities.
4. GENTLE REDIRECTION: If a child asks about something inappropriate, scary, or adult-themed, do NOT scold or judge them. Gently, kindly, and playfully steer the conversation back to fun, safe educational topics (like cute animals, fairy tales, science, stars, or nature).
   - Redirect in English, for example: "Would you like to hear a fun story about animals instead?"
5. ENCOURAGE POSITIVITY & LEARNING: Promote kindness, curiosity, reading, healthy habits, helping parents, and respect for teachers and friends.`;

export interface GeminiLiveSessionConfig {
  sessionId: string;
  deviceId: string;
  userId: string;
  systemPrompt?: string;
  language?: string;
  voiceName?: string;
}

export class GeminiLiveSession {
  private ws: WebSocket | null = null;
  private isConnected = false;
  private isSetupComplete = false;
  private isMock = false;
  private sessionTimeoutTimer?: NodeJS.Timeout;
  private latencyMetrics: LatencyMetrics;
  private pendingAudioChunks: Buffer[] = [];
  private pendingTurnComplete = false;
  private audioReady = false;
  private inputTranscript = "";
  private quickReplyPlayed = false;
  private inputEndedAt = 0;
  private previousQuickReplyId?: string;
  private inputActivity = false;

  constructor(public readonly configData: GeminiLiveSessionConfig) {
    this.latencyMetrics = {
      audioCaptureStart: Date.now(),
      firstAudioUpload: 0,
      speechDetected: 0,
      aiRequestStart: 0,
      firstAiResponse: 0,
      firstAudioResponse: 0,
      playbackStart: 0,
      totalDuration: 0,
    };
  }

  /**
   * Connect to Google Gemini Live API WebSocket endpoint
   * Using Gemini 2.0 Flash Live Multimodal WebSocket API
   */
  usable(): boolean { return this.isConnected; }

  async connect(): Promise<void> {
    const apiKey = config.GEMINI_API_KEY;
    if (!apiKey) {
      logger.warn('GEMINI_API_KEY is not set. Operating in mock AI voice mode.');
      this.setupMockSession();
      return;
    }

    const host = 'generativelanguage.googleapis.com';
    const uri = `wss://${host}/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${apiKey}`;

    try {
      await this.openLiveSocket(uri);
    } catch (error) {
      if (!(error instanceof Error) || error.name !== 'TimeoutError') throw error;
      logger.warn({ sessionId: this.configData.sessionId }, 'Retrying Gemini Live after setup timeout');
      await this.openLiveSocket(uri);
    }
  }

  private openLiveSocket(uri: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(uri);
      this.ws = socket;
      let setupReady = false;
      const deadline = setTimeout(() => {
        const error = new Error('Gemini Live setup timed out');
        error.name = 'TimeoutError';
        reject(error);
        socket.terminate();
      }, 5000);

      socket.on('open', () => this.sendInitialSetup());
      let pendingResponse = Promise.resolve();
      socket.on('message', (data: Buffer) => {
        pendingResponse = pendingResponse.then(async () => {
          if (this.ws !== socket) return;
          await this.handleGeminiServerMessage(data);
          if (!setupReady && this.isSetupComplete) {
            setupReady = true;
            clearTimeout(deadline);
            resolve();
          }
        });
      });

      socket.on('error', (err) => {
        logger.error({ sessionId: this.configData.sessionId }, 'Gemini Live WebSocket error');
        if (!setupReady) {
          clearTimeout(deadline);
          reject(new Error('Gemini Live connection failed', { cause: err }));
        }
      });
      socket.on('close', (code, reason) => {
        clearTimeout(deadline);
        if (!setupReady) reject(new Error(`Gemini Live closed before setup (code ${code})`));
        if (this.ws !== socket) return;
        this.isConnected = false;
        this.isSetupComplete = false;
        if (setupReady && getActiveEsp32Session(this.configData.deviceId)?.activeSessionId === this.configData.sessionId) {
          sendAudioCancelToEsp32(this.configData.deviceId, 'gemini_connection_closed');
        }
        logger.info({ code, reason: reason.toString(), sessionId: this.configData.sessionId }, 'Gemini Live session closed');
      });
    });
  }

  private sendInitialSetup(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    // Compose child-safe system prompt with user customizations if present
    const basePrompt = this.configData.systemPrompt
      ? `${DEFAULT_CHILD_SAFE_MEMO_PROMPT}\n\nAdditional Guidance: ${this.configData.systemPrompt}\nAlways answer aloud in English. This language rule also applies to the additional guidance.`
      : `${DEFAULT_CHILD_SAFE_MEMO_PROMPT}\nAlways answer aloud in English. This language rule also applies to the additional guidance.`;

    const setupMsg = {
      setup: {
        inputAudioTranscription: {},
        model: `models/${config.VOICE_MODEL || 'gemini-3.8-live'}`,
        realtimeInputConfig: { automaticActivityDetection: { disabled: true } },
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: this.configData.voiceName || 'Puck',
              },
            },
          },
        },
        systemInstruction: {
          parts: [
            {
              text: basePrompt,
            },
          ],
        },
        safetySettings: [
          {
            category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
            threshold: 'BLOCK_LOW_AND_ABOVE',
          },
          {
            category: 'HARM_CATEGORY_HATE_SPEECH',
            threshold: 'BLOCK_LOW_AND_ABOVE',
          },
          {
            category: 'HARM_CATEGORY_HARASSMENT',
            threshold: 'BLOCK_LOW_AND_ABOVE',
          },
          {
            category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
            threshold: 'BLOCK_LOW_AND_ABOVE',
          },
        ],
      },
    };

    this.ws.send(JSON.stringify(setupMsg));
    this.latencyMetrics.aiRequestStart = Date.now();
  }

  /**
   * Reset session inactivity timeout timer
   */
  resetInactivityTimeout(timeoutMs = 60000): void {
    if (this.sessionTimeoutTimer) {
      clearTimeout(this.sessionTimeoutTimer);
    }
    this.sessionTimeoutTimer = setTimeout(() => {
      logger.info({ sessionId: this.configData.sessionId }, 'Voice session timed out due to inactivity');
      this.close();
      const esp32Session = getActiveEsp32Session(this.configData.deviceId);
      if (esp32Session?.activeSessionId !== this.configData.sessionId) return;
      if (esp32Session) {
        esp32Session.state = 'idle';
        esp32Session.activeSessionId = undefined;
      }
      dashboardBroadcast.emitRobotState(
        this.configData.deviceId,
        this.configData.userId,
        'idle'
      );
    }, timeoutMs);
  }

  /**
   * Forward incoming PCM audio chunk from ESP32 to Gemini Live immediately
   */
  sendAudioChunk(chunk: Buffer): void {
    this.resetInactivityTimeout();

    if (!this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN || !this.isSetupComplete) {
      if (this.pendingAudioChunks.length < 150) {
        this.pendingAudioChunks.push(chunk);
      }
      return;
    }

    this.sendAudioChunkDirect(chunk);
  }

  private sendAudioChunkDirect(chunk: Buffer): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    if (this.latencyMetrics.firstAudioUpload === 0) {
      this.latencyMetrics.firstAudioUpload = Date.now();
    }

    if (!this.inputActivity) {
      this.inputTranscript = "";
      this.inputEndedAt = 0;
      this.ws.send(JSON.stringify({ realtimeInput: { activityStart: {} } }));
      this.inputActivity = true;
    }

    // Wrap raw PCM audio in realtime_input format
    const audioMsg = {
      realtimeInput: {
        audio: {
          mimeType: 'audio/pcm;rate=16000',
          data: chunk.toString('base64'),
        },
      },
    };

    this.ws.send(JSON.stringify(audioMsg));
  }

  /**
   * Complete client audio stream turn (sent when ESP32 signals audio:end)
   */
  sendAudioStreamEnd(): void {
    this.resetInactivityTimeout();

    if (!this.isConnected || !this.isSetupComplete) {
      this.pendingTurnComplete = true;
      return;
    }

    if (this.isMock) {
      logger.info({ sessionId: this.configData.sessionId }, 'Mock voice session completing simulated turn');
      // Simulate quick mock turn
      sendControlMessageToEsp32(this.configData.deviceId, 'audio:response:start', {
        sessionId: this.configData.sessionId,
        format: 'pcm_16bit',
        sampleRate: 24000,
        channels: 1,
      });

      const esp32Session = getActiveEsp32Session(this.configData.deviceId);
      if (esp32Session) {
        esp32Session.state = 'speaking';
      }
      dashboardBroadcast.emitRobotState(
        this.configData.deviceId,
        this.configData.userId,
        'speaking',
        this.configData.sessionId
      );

      setTimeout(() => {
        sendControlMessageToEsp32(this.configData.deviceId, 'audio:response:end', {
          sessionId: this.configData.sessionId,
          duration: 500,
        });

        if (esp32Session) {
          esp32Session.state = 'idle';
        }
        dashboardBroadcast.emitRobotState(
          this.configData.deviceId,
          this.configData.userId,
          'idle',
          this.configData.sessionId
        );
      }, 50);
      return;
    }

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    if (this.inputActivity) {
      this.ws.send(JSON.stringify({ realtimeInput: { activityEnd: {} } }));
      this.inputActivity = false;
      this.inputEndedAt = Date.now();
    }

  }

  private async beginPlayback(device: Esp32DeviceSession, source?: 'quick_reply'): Promise<boolean> {
    const { deviceId, sessionId, userId } = this.configData;
    this.latencyMetrics.firstAudioResponse = Date.now();
    const readyAck = waitForEsp32AudioReady(deviceId, sessionId, 800);
    sendControlMessageToEsp32(deviceId, 'audio:response:start', {
      sessionId, source, wireCodec: device.playbackCodec, format: 'pcm_16bit', sampleRate: 24000, channels: 1,
    });
    device.state = 'speaking';
    dashboardBroadcast.emitRobotState(deviceId, userId, 'speaking', sessionId);
    const ready = await readyAck;
    if (getActiveEsp32Session(deviceId) !== device || device.activeSessionId !== sessionId) return false;
    if (ready) this.latencyMetrics.playbackStart = Date.now();
    else logger.error({ deviceId, sessionId }, 'ESP32 audio readiness handshake failed. Aborting audio turn.');
    return ready;
  }

  private async playQuickReply(device: Esp32DeviceSession, reply: NonNullable<ReturnType<typeof getQuickReply>>) {
    const { deviceId, sessionId, userId } = this.configData;
    this.quickReplyPlayed = true;
    this.previousQuickReplyId = undefined;
    this.audioReady = await this.beginPlayback(device, 'quick_reply');
    if (!this.audioReady) return;
    const canPlay = () => this.isConnected
      && getActiveEsp32Session(deviceId) === device
      && device.activeSessionId === sessionId
      && device.state === 'speaking';
    logger.info({ replyId: reply.id, sessionId, speechEndToReadyMs: Date.now() - this.inputEndedAt }, 'Playing prerecorded voice reply');
    dashboardBroadcast.emitTranscription(userId, sessionId, reply.text, true, 'assistant');
    let complete = false;
    try {
      complete = await streamRecordedPcm(deviceId, sessionId, [reply.pcm], canPlay);
    } catch (err) {
      logger.error({ err, sessionId }, 'Prerecorded voice playback stalled');
    } finally {
      this.audioReady = false;
    }
    if (!canPlay()) return;
    if (complete) {
      this.previousQuickReplyId = reply.id;
      sendControlMessageToEsp32(deviceId, 'audio:response:end', { sessionId });
    } else {
      sendAudioCancelToEsp32(deviceId, 'quick_reply_delivery_stalled');
    }
    device.state = 'idle';
    dashboardBroadcast.emitRobotState(deviceId, userId, 'idle', sessionId);
  }

  /**
   * Handle incoming streaming response from Gemini Live
   */
  private async handleGeminiServerMessage(raw: Buffer): Promise<void> {
    try {
      const response = JSON.parse(raw.toString('utf-8'));

      // Handle setupComplete event: flush any audio queued while connecting
      if (response.setupComplete) {
        this.isConnected = true;
        logger.info({ sessionId: this.configData.sessionId }, 'Gemini Live setup completed, flushing buffered audio');
        this.isSetupComplete = true;
        while (this.pendingAudioChunks.length > 0) {
          const chunk = this.pendingAudioChunks.shift();
          if (chunk) {
            this.sendAudioChunkDirect(chunk);
          }
        }
        if (this.pendingTurnComplete) {
          this.pendingTurnComplete = false;
          this.sendAudioStreamEnd();
        }
        return;
      }

      const activeDevice = getActiveEsp32Session(this.configData.deviceId);
      if (activeDevice?.activeSessionId !== this.configData.sessionId) return;

      const fragment = response.serverContent?.inputTranscription?.text;
      if (typeof fragment === 'string' && this.latencyMetrics.firstAudioResponse === 0) {
        const segment = normalizeQuestion(fragment);
        if (segment && segment !== this.inputTranscript) {
          this.inputTranscript = segment.startsWith(this.inputTranscript + ' ')
            ? segment
            : (this.inputTranscript + ' ' + segment).trim();
        }
      }

      // 1. Check for User Barge-in / Interruption event from Gemini Live
      if (response.serverContent?.interrupted) {
        if (!this.quickReplyPlayed) this.previousQuickReplyId = undefined;
        logger.info({ sessionId: this.configData.sessionId }, 'Gemini Live detected user barge-in interruption');
        // Stop audio playback on ESP32 immediately
        if (!this.quickReplyPlayed) sendAudioCancelToEsp32(this.configData.deviceId, 'interruption');
        if (!response.serverContent?.turnComplete) return;
      }

      // Match the final input-transcription event after the ESP32 has ended this utterance.
      // Interim transcripts and early partial input can be prefixes of a different question.
      if (fragment && response.serverContent?.inputTranscription?.finished !== false &&
          this.inputEndedAt && !this.inputActivity && !this.latencyMetrics.firstAudioResponse &&
          !response.serverContent?.interrupted && activeDevice.state === 'thinking') {
        const reply = getQuickReply(this.inputTranscript, this.previousQuickReplyId);
        if (reply) await this.playQuickReply(activeDevice, reply);
      }

      const modelTurn = response.serverContent?.interrupted ? undefined : response.serverContent?.modelTurn;
      if (modelTurn?.parts) {
        for (const part of modelTurn.parts) {
          // If text transcription part is returned
          if (part.text && !this.quickReplyPlayed) {
            if (this.latencyMetrics.firstAiResponse === 0) {
              this.latencyMetrics.firstAiResponse = Date.now();
            }
            dashboardBroadcast.emitTranscription(
              this.configData.userId,
              this.configData.sessionId,
              part.text,
              false,
              'assistant'
            );
          }

          // If raw PCM audio part is returned
          if (part.inlineData?.data && !this.quickReplyPlayed) {
            const pcmBuffer = Buffer.from(part.inlineData.data, 'base64');

            if (this.latencyMetrics.firstAudioResponse === 0) {
              const quickReply = this.inputActivity
                ? undefined
                : getQuickReply(this.inputTranscript, this.previousQuickReplyId);
              if (quickReply) {
                await this.playQuickReply(activeDevice, quickReply);
                continue;
              }
              this.previousQuickReplyId = undefined;
              this.audioReady = await this.beginPlayback(activeDevice);
            }

            if (!this.audioReady) continue;
            const sessionId = this.configData.sessionId;
            const canPlay = () => this.isConnected
              && getActiveEsp32Session(this.configData.deviceId) === activeDevice
              && activeDevice.activeSessionId === sessionId
              && activeDevice.state === 'speaking';
            const deadline = performance.now() + 8000;
            while (activeDevice.playbackCodec && canPlay() &&
                   (activeDevice.pausedPlaybackSessionId === sessionId || activeDevice.socket.bufferedAmount >= 4096)) {
              if (performance.now() >= deadline) {
                this.audioReady = false;
                sendAudioCancelToEsp32(this.configData.deviceId, 'gemini_audio_delivery_stalled');
                break;
              }
              await new Promise<void>((resolve) => setTimeout(resolve, 20));
            }
            if (!canPlay()) return;
            if (this.audioReady && !sendPlaybackPcmToEsp32(
              this.configData.deviceId, pcmBuffer, activeDevice.playbackCodec,
            )) this.audioReady = false;
          }
        }
      }

      // Check if turn is complete
      if (response.serverContent?.turnComplete) {
        this.latencyMetrics.totalDuration = Date.now() - this.latencyMetrics.audioCaptureStart;

        if (!this.quickReplyPlayed) {
          this.previousQuickReplyId = undefined;
          if (this.audioReady) {
            sendControlMessageToEsp32(this.configData.deviceId, 'audio:response:end', {
              sessionId: this.configData.sessionId,
              duration: this.latencyMetrics.totalDuration,
            });
          } else {
            sendAudioCancelToEsp32(this.configData.deviceId, 'gemini_no_playable_audio');
          }
          activeDevice.state = 'idle';
          dashboardBroadcast.emitRobotState(
            this.configData.deviceId, this.configData.userId, 'idle', this.configData.sessionId,
          );
        } else if (activeDevice.state === 'speaking' && !this.audioReady) {
          sendAudioCancelToEsp32(this.configData.deviceId, 'quick_reply_not_ready');
          activeDevice.state = 'idle';
          dashboardBroadcast.emitRobotState(
            this.configData.deviceId, this.configData.userId, 'idle', this.configData.sessionId,
          );
        }
        this.audioReady = false;
        this.quickReplyPlayed = false;
        if (!this.inputActivity && activeDevice.state !== 'thinking') {
          this.inputTranscript = "";
          this.inputEndedAt = 0;
        }

        // Reset turn response markers for next turn
        this.latencyMetrics.firstAiResponse = 0;
        this.latencyMetrics.firstAudioResponse = 0;
        this.latencyMetrics.playbackStart = 0;
      }
    } catch (err) {
      logger.error({ err }, 'Error handling Gemini Live message');
    }
  }

  /**
   * Mock session for testing when API key is not yet configured
   */
  private setupMockSession(): void {
    this.isMock = true;
    this.isConnected = true;
    this.resetInactivityTimeout();
    logger.info({ sessionId: this.configData.sessionId }, 'Initialized Mock Voice AI Session');
  }

  close(): void {
    if (this.sessionTimeoutTimer) {
      clearTimeout(this.sessionTimeoutTimer);
      this.sessionTimeoutTimer = undefined;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
  }
}

