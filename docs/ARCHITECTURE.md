# AI Voice Assistant Robot Platform — Architecture Guide

## 1. System Architecture Overview

The platform connects physical ESP32-S3 robots, Web Dashboards, and AI Voice systems through a decoupled microservice architecture:

```mermaid
flowchart TD
    subgraph Clients
        ESP32["ESP32-S3 Physical Robot"]
        WEB["React / Next.js Web Dashboard"]
        TG["Telegram Bot"]
    end

    subgraph "Nginx Reverse Proxy (:80 / :443)"
        NGINX["Nginx Proxy / SSL"]
    end

    subgraph "Node.js Core Backend (Fastify + TypeScript)"
        WS_ESP["Native RFC 6455 WebSocket Gateway (/ws/esp32)"]
        SIO_DASH["Socket.IO Gateway (/socket.io/)"]
        REST["REST API Layer (/api/v1/*)"]
        MQTT_B["Aedes Embedded MQTT Broker (:1883)"]
        AUTH_M["Auth & Device Security"]
        TODO_M["Todo & Reminders Manager"]
        AUDIO_M["Audio Storage (MongoDB GridFS)"]
        MCP_M["MCP Tool Registry"]
        KNOW_M["RAG Knowledge Gateway"]
    end

    subgraph "Python AI Microservices (FastAPI)"
        PY_API["FastAPI Orchestrator"]
        GEMINI_P["Gemini Provider (Flash & Pro & Live)"]
        OPENAI_P["OpenAI Fallback Provider"]
        ELEVEN_P["ElevenLabs TTS Provider"]
        EMBED_P["Vector Embedding Engine"]
    end

    subgraph "Data & Cache Layer"
        MONGO[("MongoDB 7+ (Mongoose)")]
        REDIS[("Redis 7+ (BullMQ)")]
    end

    subgraph "Cloud AI Services"
        GEMINI_LIVE["Google Gemini Live API"]
        TG_API["Telegram Bot API"]
    end

    ESP32 -->|Native WS Audio/JSON| NGINX
    WEB -->|HTTPS & Socket.IO| NGINX
    TG --> TG_API --> REST

    NGINX -->|/ws/esp32| WS_ESP
    NGINX -->|/socket.io/| SIO_DASH
    NGINX -->|/api/*| REST

    WS_ESP -->|Real-time Bidi Streaming| GEMINI_LIVE
    REST --> AUTH_M
    REST --> TODO_M
    REST --> AUDIO_M
    REST --> MCP_M
    REST --> KNOW_M

    TODO_M --> REDIS
    AUDIO_M --> MONGO
    KNOW_M --> MONGO
    AUTH_M --> MONGO

    KNOW_M -->|HTTP/REST| PY_API
    PY_API --> EMBED_P
    PY_API --> GEMINI_P
```

---

## 2. Real-Time Communication Protocols

### Layer 1: ESP32-S3 ↔ Backend
- **Protocol:** Native RFC 6455 WebSocket (`ws://` / `wss://`)
- **Route:** `/ws/esp32`
- **Audio Framing:** Raw binary frames (16kHz 16-bit PCM). Zero packaging overhead.
- **Control Framing:** Lightweight JSON text frames (`device:heartbeat`, `touch:event`, `robot:command`).
- **Why NOT Socket.IO?** Microcontrollers have strict memory (RAM) and CPU limits. RFC 6455 avoids the Socket.IO polling fallback, ping/pong JSON framing, and packet fragmentation overhead.

### Layer 2: Web Dashboard ↔ Backend
- **Protocol:** Socket.IO
- **Route:** `/socket.io/`
- **Rooms:** `user:<userId>`, `device:<deviceId>`, `conversation:<conversationId>`
- **Events:** `device:status`, `robot:state` (idle, listening, thinking, speaking), `robot:touch`, `audio:transcription`, `reminder:triggered`.
- **Purpose:** Powers real-time state visualization, remote teleoperation, live transcriptions, and notification popups on modern browsers.

### Layer 3: Backend ↔ Gemini Live API
- **Protocol:** Gemini Multimodal Bidi WebSocket (`BidiGenerateContent`)
- **Latency Strategy:** Audio chunks from ESP32 are immediately forwarded without waiting for complete recording sentences.
- **Barge-in / Interruption:** When Gemini Live server detects incoming user speech during playback, it sends an `interrupted` signal. The backend immediately dispatches `audio:cancel` to the robot to halt audio playback instantaneously.

---

## 3. Storage Architecture

| Data Type | Storage Engine | Strategy |
|---|---|---|
| Users & Devices | MongoDB Collections | Document index on `email`, `macAddress` |
| Tasks & Reminders | MongoDB Collections | TTL, compound indexes on `userId` + `status` |
| Audio Recordings | MongoDB GridFS | Segmented 255KB chunks, streaming with HTTP 206 Partial Content |
| Vector Chunks | MongoDB Atlas Vector Search | 768-dimension cosine similarity index with keyword fallback |
| Job Queues | Redis (BullMQ) | Persistent delayed jobs for reminder notifications |
