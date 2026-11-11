# AI Voice & Thinking Engine Integration Guide

## 1. Supported AI Providers

The architecture is provider-agnostic and supports:
1. **Google Gemini Live Multimodal WebSocket API** (Primary speech-to-speech engine)
2. **Google Gemini Flash & Pro** (Fast conversation and deep reasoning)
3. **ElevenLabs** (High-fidelity expressive text-to-speech fallback)
4. **OpenAI Whisper & GPT-4o-mini** (Secondary fallback for cascade mode)
5. **Ollama** (Optional local LLM inference)

---

## 2. Voice Pipeline Modes

### Native Mode (`VOICE_MODE=native`)
Direct bidirectional speech-to-speech with **Google Gemini Live**:
- Continuous bidirectional audio streaming.
- **Latency:** ~300ms–500ms round-trip.
- **Interruption:** Built-in barge-in detection.

```
ESP32 (Mic) ──(PCM 16kHz)──> Fastify Gateway ──> Gemini Live WebSocket
ESP32 (Spk) <──(PCM 24kHz)── Fastify Gateway <── Gemini Live WebSocket
```

### Cascade Mode (`VOICE_MODE=cascade`)
Modular pipeline when speech-to-speech is unavailable or custom TTS voices are required:
```
ESP32 Audio ──> STT (Whisper/Gemini) ──> Thinking LLM ──> TTS (ElevenLabs) ──> ESP32 Speaker
```

---

## 3. Configuration & Switching Models

All models and keys are configured via environment variables in `.env`:
```env
# AI Models
FAST_MODEL=gemini-2.0-flash
THINKING_MODEL=gemini-2.0-pro
VOICE_MODEL=gemini-2.0-flash-live

# Primary Keys
GEMINI_API_KEY=AIzaSy...
ELEVENLABS_API_KEY=...
OPENAI_API_KEY=...
```

Changing models requires updating `.env` without modifying any business logic.
