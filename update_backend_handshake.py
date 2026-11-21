import re

# 1. Update esp32.gateway.ts
gateway_path = r'C:\Users\USER\Desktop\Ai_Robot_BE_CICD\apps\backend\src\websocket\esp32.gateway.ts'
with open(gateway_path, 'r', encoding='utf-8') as f:
    gw_code = f.read()

old_wait = '''export async function waitForEsp32AudioReady(deviceId: string, sessionId: string, timeoutMs = 350): Promise<boolean> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      cleanup();
      resolve(false);
    }, timeoutMs);

    const onReady = () => {
      cleanup();
      resolve(true);
    };

    const cleanup = () => {
      clearTimeout(timer);
      esp32AudioEvents.off(`ready:${deviceId}:${sessionId}`, onReady);
    };

    esp32AudioEvents.once(`ready:${deviceId}:${sessionId}`, onReady);
  });
}'''

new_wait = '''export async function waitForEsp32AudioReady(deviceId: string, sessionId: string, timeoutMs = 800): Promise<boolean> {
  return new Promise((resolve) => {
    let timer: NodeJS.Timeout;
    const onReady = (gen?: number) => {
      cleanup();
      resolve(true);
    };

    const cleanup = () => {
      clearTimeout(timer);
      esp32AudioEvents.off(`ready:${deviceId}:${sessionId}`, onReady);
    };

    timer = setTimeout(() => {
      cleanup();
      logger.warn({ deviceId, sessionId }, 'Timed out waiting for ESP32 audio:ready acknowledgement');
      resolve(false);
    }, timeoutMs);

    esp32AudioEvents.once(`ready:${deviceId}:${sessionId}`, onReady);
  });
}'''

if old_wait in gw_code:
    gw_code = gw_code.replace(old_wait, new_wait)
    print("Updated waitForEsp32AudioReady in esp32.gateway.ts")

old_cases = '''          case 'audio:ready': {
            const sessId = (payload.sessionId as string | undefined) || '';
            logger.info({ deviceId, sessId }, 'ESP32 acknowledged audio session readiness');
            esp32AudioEvents.emit(`ready:${deviceId}:${sessId}`);
            break;
          }

          case 'audio:flow': {
            const status = (payload.status as string | undefined) || 'resume';
            logger.info({ deviceId, status }, 'ESP32 audio buffer watermark flow control');
            esp32AudioEvents.emit(`flow:${deviceId}`, status);
            break;
          }'''

new_cases = '''          case 'audio:ready': {
            const sessId = (payload.sessionId as string | undefined) || '';
            const gen = payload.generation as number | undefined;
            logger.info({ deviceId, sessId, gen }, 'ESP32 acknowledged audio session readiness');
            esp32AudioEvents.emit(`ready:${deviceId}:${sessId}`, gen);
            break;
          }

          case 'audio:flow': {
            const status = (payload.status as string | undefined) || 'resume';
            const sessId = (payload.sessionId as string | undefined) || '';
            const gen = payload.generation as number | undefined;
            logger.info({ deviceId, status, sessId, gen }, 'ESP32 audio buffer watermark flow control');
            esp32AudioEvents.emit(`flow:${deviceId}`, status);
            if (sessId) {
              esp32AudioEvents.emit(`flow:${deviceId}:${sessId}`, { status, generation: gen });
            }
            break;
          }'''

if old_cases in gw_code:
    gw_code = gw_code.replace(old_cases, new_cases)
    print("Updated audio:ready and audio:flow cases in esp32.gateway.ts")

with open(gateway_path, 'w', encoding='utf-8') as f:
    f.write(gw_code)


# 2. Update audio.service.ts
audio_svc_path = r'C:\Users\USER\Desktop\Ai_Robot_BE_CICD\apps\backend\src\modules\audio\audio.service.ts'
with open(audio_svc_path, 'r', encoding='utf-8') as f:
    svc_code = f.read()

old_svc_wait = '''    // 2. Handshake: Wait for ESP32 Audio Engine to flush previous audio and acknowledge readiness
    const isReady = await waitForEsp32AudioReady(deviceId, playSessionId, 400);
    logger.info({ deviceId, playSessionId, isReady }, 'ESP32 audio readiness confirmed');'''

new_svc_wait = '''    // 2. Handshake: Wait for ESP32 Audio Engine to flush previous audio and acknowledge readiness
    const isReady = await waitForEsp32AudioReady(deviceId, playSessionId, 800);
    if (!isReady) {
      logger.error({ deviceId, playSessionId }, 'ESP32 audio readiness handshake failed or timed out. Aborting audio playback to prevent corrupting buffer.');
      throw new BadRequestError('ESP32 audio readiness handshake timed out');
    }
    logger.info({ deviceId, playSessionId }, 'ESP32 audio readiness confirmed by handshake ACK');'''

if old_svc_wait in svc_code:
    svc_code = svc_code.replace(old_svc_wait, new_svc_wait)
    print("Updated handshake check in audio.service.ts")

with open(audio_svc_path, 'w', encoding='utf-8') as f:
    f.write(svc_code)


# 3. Update gemini-live.client.ts
gemini_path = r'C:\Users\USER\Desktop\Ai_Robot_BE_CICD\apps\backend\src\modules\voice\gemini-live.client.ts'
with open(gemini_path, 'r', encoding='utf-8') as f:
    gem_code = f.read()

old_gem_wait = '''              // Handshake: wait briefly for ESP32 audio task to clear previous buffer
              await waitForEsp32AudioReady(this.configData.deviceId, this.configData.sessionId, 300);'''

new_gem_wait = '''              // Handshake: wait for ESP32 audio task to clear previous buffer and confirm readiness
              const isReady = await waitForEsp32AudioReady(this.configData.deviceId, this.configData.sessionId, 800);
              if (!isReady) {
                logger.error({ deviceId: this.configData.deviceId, sessionId: this.configData.sessionId }, 'ESP32 audio readiness handshake failed. Aborting audio turn.');
                return;
              }'''

if old_gem_wait in gem_code:
    gem_code = gem_code.replace(old_gem_wait, new_gem_wait)
    print("Updated handshake check in gemini-live.client.ts")

with open(gemini_path, 'w', encoding='utf-8') as f:
    f.write(gem_code)

print("Backend update script completed!")
