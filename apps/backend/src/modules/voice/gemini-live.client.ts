import { WebSocket } from 'ws';
import { logger } from '../../utils/logger.js';
import { config } from '../../config/index.js';
import {
  sendAudioChunkToEsp32,
  sendAudioCancelToEsp32,
  sendControlMessageToEsp32,
  getActiveEsp32Session,
  waitForEsp32AudioReady,
} from '../../websocket/esp32.gateway.js';
import { dashboardBroadcast } from '../../websocket/dashboard.gateway.js';
import { LatencyMetrics } from '@ai-robot/shared-types';

export const DEFAULT_CHILD_SAFE_MEMO_PROMPT = `You are "Memo" (မေမို), a friendly, cheerful, loving, and educational AI companion robot designed specifically for children.

Core Personality & Identity:
- Your name is Memo. Always introduce or recognize yourself as Memo.
- When children greet or call you "Memo", "Hi Memo", or "Hello Memo", greet them with excitement, warmth, and joy!
- Speak simply, clearly, gently, and in a kid-friendly tone (suitable for ages 4 to 12).
- Keep spoken responses short, concise (1 to 3 short sentences), natural, and engaging.
- You naturally understand and speak both Myanmar (Burmese) and English. Match the language the child speaks to you.

STRICT CHILD SAFETY GUARDRAILS (CRITICAL & ABSOLUTE):
1. ZERO TOLERANCE FOR SEXUAL OR ADULT CONTENT: Under NO circumstances should you discuss, mention, describe, or reference sexual topics, anatomy, romance, dating, reproduction, or mature themes.
2. NO PROFANITY, CURSING, OR OFFENSIVE WORDS: Never use vulgarity, swear words, insults, derogatory terms, or mean language in any language (English, Burmese, or slang).
3. NO VIOLENCE, WEAPONS, OR HARMFUL ACTIONS: Never discuss weapons, guns, knives, fighting, suicide, self-harm, drugs, smoking, alcohol, or dangerous activities.
4. GENTLE REDIRECTION: If a child asks about something inappropriate, scary, or adult-themed, do NOT scold or judge them. Gently, kindly, and playfully steer the conversation back to fun, safe educational topics (like cute animals, fairy tales, science, stars, or nature).
   - Example in Burmese: "ဟိုဒင်း... မေမိုက ကလေးတို့နဲ့ ပျော်စရာ ပုံပြင်လေးတွေ၊ သဘာဝတရားနဲ့ တိရစ္ဆာန်လေးတွေအကြောင်းပဲ ပြောတတ်တယ်နော်! အတူတူ ပုံပြင်နားထောင်မလား?"
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

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(uri, { handshakeTimeout: 8000 });

        this.ws.on('open', () => {
          this.isConnected = true;
          logger.info({ sessionId: this.configData.sessionId }, 'Connected to Gemini Live WebSocket');

          // Send initial setup message to configure model, voice and system prompt
          this.sendInitialSetup();
          resolve();
        });

        let pendingResponse = Promise.resolve();
        this.ws.on('message', (data: Buffer) => {
          pendingResponse = pendingResponse.then(() => this.handleGeminiServerMessage(data));
        });

        this.ws.on('error', (err) => {
          logger.error({ err, sessionId: this.configData.sessionId }, 'Gemini Live WebSocket error');
          reject(err);
        });

        this.ws.on('close', (code, reason) => {
          this.isConnected = false;
          logger.info({ code, reason: reason.toString(), sessionId: this.configData.sessionId }, 'Gemini Live session closed');
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  private sendInitialSetup(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    // Compose child-safe system prompt with user customizations if present
    const basePrompt = this.configData.systemPrompt
      ? `${DEFAULT_CHILD_SAFE_MEMO_PROMPT}\n\nAdditional Guidance: ${this.configData.systemPrompt}\nLanguage: ${this.configData.language || 'English or Burmese'}.`
      : `${DEFAULT_CHILD_SAFE_MEMO_PROMPT}\nLanguage: ${this.configData.language || 'English or Burmese'}.`;

    const setupMsg = {
      setup: {
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
      this.ws.send(JSON.stringify({ realtimeInput: { activityStart: {} } }));
      this.inputActivity = true;
    }

    // Wrap raw PCM audio in realtime_input format
    const audioMsg = {
      realtimeInput: {
        mediaChunks: [
          {
            mimeType: 'audio/pcm;rate=16000',
            data: chunk.toString('base64'),
          },
        ],
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
    }

  }

  /**
   * Handle incoming streaming response from Gemini Live
   */
  private async handleGeminiServerMessage(raw: Buffer): Promise<void> {
    try {
      const response = JSON.parse(raw.toString('utf-8'));

      // Handle setupComplete event: flush any audio queued while connecting
      if (response.setupComplete) {
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

      // 1. Check for User Barge-in / Interruption event from Gemini Live
      if (response.serverContent?.interrupted) {
        logger.info({ sessionId: this.configData.sessionId }, 'Gemini Live detected user barge-in interruption');
        // Stop audio playback on ESP32 immediately
        sendAudioCancelToEsp32(this.configData.deviceId, 'interruption');
        return;
      }

      const modelTurn = response.serverContent?.modelTurn;
      if (modelTurn?.parts) {
        for (const part of modelTurn.parts) {
          // If text transcription part is returned
          if (part.text) {
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
          if (part.inlineData?.data) {
            const pcmBuffer = Buffer.from(part.inlineData.data, 'base64');

            if (this.latencyMetrics.firstAudioResponse === 0) {
              this.latencyMetrics.firstAudioResponse = Date.now();
              this.latencyMetrics.playbackStart = Date.now();
              // Notify ESP32 that audio response is starting
              const readyAck = waitForEsp32AudioReady(this.configData.deviceId, this.configData.sessionId, 800);
              sendControlMessageToEsp32(this.configData.deviceId, 'audio:response:start', {
                sessionId: this.configData.sessionId,
                format: 'pcm_16bit',
                sampleRate: 24000, // Gemini Live standard output is 24kHz PCM
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

              // Handshake: wait for ESP32 audio task to clear previous buffer and confirm readiness
              this.audioReady = await readyAck;
              if (!this.audioReady) {
                logger.error({ deviceId: this.configData.deviceId, sessionId: this.configData.sessionId }, 'ESP32 audio readiness handshake failed. Aborting audio turn.');
              }
            }

            // Stream PCM chunk to ESP32 speaker as binary frame
            if (this.audioReady) sendAudioChunkToEsp32(this.configData.deviceId, pcmBuffer);
          }
        }
      }

      // Check if turn is complete
      if (response.serverContent?.turnComplete) {
        this.latencyMetrics.totalDuration = Date.now() - this.latencyMetrics.audioCaptureStart;

        sendControlMessageToEsp32(this.configData.deviceId, 'audio:response:end', {
          sessionId: this.configData.sessionId,
          duration: this.latencyMetrics.totalDuration,
        });

        const esp32Session = getActiveEsp32Session(this.configData.deviceId);
        if (esp32Session) {
          esp32Session.state = 'idle';
        }

        dashboardBroadcast.emitRobotState(
          this.configData.deviceId,
          this.configData.userId,
          'idle',
          this.configData.sessionId
        );

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

