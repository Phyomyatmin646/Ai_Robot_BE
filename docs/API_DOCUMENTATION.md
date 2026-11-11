# AI Voice Assistant Robot Platform — API Documentation

Interactive Swagger documentation is available at `http://localhost:3000/api/docs`.

---

## 1. Authentication Endpoints (`/api/v1/auth`)

### `POST /api/v1/auth/register`
Create a new user account.
```json
// Request Body
{
  "name": "Alex Mercer",
  "email": "alex@example.com",
  "password": "StrongPassword123!",
  "language": "en",
  "timezone": "Asia/Yangon"
}
```

### `POST /api/v1/auth/login`
Authenticate with email and password. Returns JWT access and refresh tokens.
```json
// Request Body
{
  "email": "alex@example.com",
  "password": "StrongPassword123!"
}
// Response Data
{
  "success": true,
  "data": {
    "user": { "id": "...", "name": "Alex Mercer", "email": "alex@example.com" },
    "tokens": {
      "accessToken": "eyJhbGciOi...",
      "refreshToken": "7a8b9c...",
      "expiresIn": 900
    }
  }
}
```

### `POST /api/v1/auth/refresh`
Rotate refresh token and get a new access token.

---

## 2. Device Management (`/api/v1/devices`)

### `POST /api/v1/devices/register`
Registers an ESP32-S3 robot. Returns a secure `apiKey`.
```json
// Request Body
{
  "name": "My Robot Desk Companion",
  "deviceType": "esp32-s3",
  "macAddress": "E0:5A:1B:90:3A:42",
  "firmwareVersion": "1.0.0",
  "hardwareVersion": "ESP32-S3-WROOM-1"
}
```

### `GET /api/v1/devices`
List all devices registered to the user.

### `PATCH /api/v1/devices/:id/config`
Update hardware parameters (e.g. volume level, brightness, LED).

---

## 3. Robot Settings (`/api/v1/settings`)

### `GET /api/v1/settings/device/:deviceId`
Retrieve current voice, sound, display, and hardware settings.

### `PATCH /api/v1/settings/device/:deviceId`
Update settings with immediate real-time synchronization to the physical robot.
```json
{
  "sound": { "masterVolume": 90 },
  "display": { "brightness": 60 },
  "voice": { "voiceId": "Puck", "language": "my" }
}
```

---

## 4. Todo & Reminders (`/api/v1/todo`, `/api/v1/reminders`)

### `POST /api/v1/todo`
Create a task.
```json
{
  "title": "Buy electronic parts for robot base",
  "priority": "high",
  "dueDate": "2026-11-15T18:00:00+06:30"
}
```

### `POST /api/v1/reminders`
Schedule a persistent reminder.
```json
{
  "title": "Attend robotics weekly sync",
  "scheduledAt": "2026-11-12T10:00:00+06:30",
  "timezone": "Asia/Yangon",
  "recurrence": "weekly",
  "notifyVia": ["websocket", "telegram"]
}
```

---

## 5. Audio Library (`/api/v1/audio`)

### `GET /api/v1/audio`
List recordings with filtering by date, conversation, and device.

### `GET /api/v1/audio/:id/stream`
Stream audio recording with HTTP 206 Partial Content support for seeking.
Supports `Range: bytes=0-1048576` headers.

---

## 6. RAG Knowledge Base (`/api/v1/knowledge`)

### `POST /api/v1/knowledge`
Upload text document to teach the robot new knowledge.

### `GET /api/v1/knowledge/search?q=query`
Perform semantic vector search across personal knowledge documents.

---

## 7. MCP Tool System (`/api/v1/mcp`)

### `GET /api/v1/mcp/tools`
List all registered MCP tools and JSON schemas.

### `POST /api/v1/mcp/execute`
Execute authorized MCP tool with validation and audit logging.
```json
{
  "toolName": "get_weather",
  "arguments": { "location": "Yangon" }
}
```

