# ESP32-S3 Physical Robot Integration Overview

This document provides a summary of the ESP32-S3 physical robot integration.  
For the complete technical firmware protocol and hardware specifications, refer to [firmware-integration.md](./firmware-integration.md).

---

## Key Highlights

1. **Native RFC 6455 WebSocket:**
   - The ESP32 connects directly to `ws://<server>:3000/ws/esp32`.
   - Native binary frames are used for bidirectional audio transfer (16kHz PCM mono).
   - No Socket.IO overhead on the microcontroller.

2. **Hardware Events Supported:**
   - Touch Sensor (Capacitive Pin GPIO 1 / Touch 1): Tap to talk, long press to re-provision.
   - Volume Buttons (GPIO 41 & 42): Physical hardware volume control with backend telemetry.
   - Status RGB LED (WS2812B): Visual states for idle, listening, thinking, speaking, and offline.
   - Display Screen (STT789 240x240): Face animations and text status.

3. **Interruption (Barge-In):**
   - Real-time response cancellation when user speaks during robot playback.
   - Zero-lag audio streaming directly connected with Google Gemini Live API.

