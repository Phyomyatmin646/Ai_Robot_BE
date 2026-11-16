import { WebSocket } from 'ws';
import { logger } from '../../utils/logger.js';
import { config } from '../../config/index.js';
import {
  sendAudioChunkToEsp32,
  sendAudioCancelToEsp32,
  sendControlMessageToEsp32,
  getActiveEsp32Session,
} from '../../websocket/esp32.gateway.js';
import { dashboardBroadcast } from '../../websocket/dashboard.gateway.js';
import { LatencyMetrics } from '@ai-robot/shared-types';

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
  private isMock = false;
  private sessionTimeoutTimer?: NodeJS.Timeout;
  private latencyMetrics: LatencyMetrics;

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
        this.ws = new WebSocket(uri);

        this.ws.on('open', () => {
          this.isConnected = true;
          logger.info({ sessionId: this.configData.sessionId }, 'Connected to Gemini Live WebSocket');

          // Send initial setup message to configure model, voice and system prompt
          this.sendInitialSetup();
          resolve();
        });

        this.ws.on('message', (data: Buffer) => {
          this.handleGeminiServerMessage(data);
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

    const setupMsg = {
      setup: {
        model: `models/${config.VOICE_MODEL || 'gemini-3.8-live'}`,
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
              text:
                this.configData.systemPrompt ||
                `You are a friendly, helpful, and concise AI Robot companion.
Keep responses short, natural, and conversational, suitable for speech synthesis.
Language: ${this.configData.language || 'English'}.`,
            },
          ],
        },
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

    if (!this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    if (this.latencyMetrics.firstAudioUpload === 0) {
      this.latencyMetrics.firstAudioUpload = Date.now();
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

    if (!this.isConnected) return;

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

    // Signal turnComplete to Gemini Live
    const turnCompleteMsg = {
      clientContent: {
        turnComplete: true,
      },
    };
    this.ws.send(JSON.stringify(turnCompleteMsg));
    logger.info({ sessionId: this.configData.sessionId }, 'Sent clientContent turnComplete to Gemini Live');
  }

  /**
   * Handle incoming streaming response from Gemini Live
   */
  private handleGeminiServerMessage(raw: Buffer): void {
    try {
      const response = JSON.parse(raw.toString('utf-8'));

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
            }

            // Stream PCM chunk to ESP32 speaker as binary frame
            sendAudioChunkToEsp32(this.configData.deviceId, pcmBuffer);
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

