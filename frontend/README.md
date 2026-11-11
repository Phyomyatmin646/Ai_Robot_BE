# AI Voice Assistant Robot Platform — Web Dashboard Frontend

This folder is designated for the Web Dashboard frontend (React / Next.js / Vite).

## Overview

The Web Dashboard communicates with the backend via two interfaces:
1. **REST APIs (`http://localhost:3000/api/v1/`)**:
   - Authentication (JWT login, register, profile)
   - Robot registration & configuration
   - Task & Todo management
   - Reminders scheduling
   - Audio library with Range streaming playback
   - RAG knowledge document uploads & semantic search
   - Settings management (Voice, Sound, Display, AI personality)
   - Analytics & Telemetry

2. **Socket.IO (`ws://localhost:3000/socket.io/`)**:
   - Real-time robot status (`device:status`)
   - Real-time robot state transitions:
     - `idle`
     - `listening` (Microphone recording active)
     - `thinking` (AI processing / RAG / MCP tools running)
     - `speaking` (Speaker audio playback active)
   - Live touch sensor notifications (`robot:touch`)
   - Live audio streaming transcriptions (`audio:transcription`)
   - New notifications & reminder triggered alerts (`notification:new`, `reminder:triggered`)

## Recommended Stack
- **Framework:** Next.js 14+ (App Router) or Vite + React 18+
- **Styling:** Tailwind CSS + Radix UI / shadcn/ui
- **State Management:** Zustand / TanStack Query
- **Real-Time Client:** `socket.io-client`
- **Audio Visualizer:** Web Audio API (AudioContext, AnalyserNode)

