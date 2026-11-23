import { setTimeout as delay } from 'node:timers/promises';
import { esp32AudioEvents, getActiveEsp32Session, sendAudioChunkToEsp32 } from './esp32.gateway.js';

const FRAME_BYTES = 3840;
const BURST_BYTES = 11520;
const MAX_SOCKET_QUEUE_BYTES = 16 * 1024;
// Mono PCM plays at 48 bytes/ms. Send faster so the receiver can recover lost lead.
const SEND_BYTES_PER_MS = 64;

export async function streamRecordedPcm(
  deviceId: string,
  sessionId: string,
  chunks: AsyncIterable<Buffer> | Iterable<Buffer>,
  isCurrent: () => boolean,
): Promise<boolean> {
  const socket = getActiveEsp32Session(deviceId)?.socket;
  if (!socket) return false;
  const flowEvent = `flow:${deviceId}:${sessionId}`;
  let paused = false;
  let nextSend = performance.now() - BURST_BYTES / SEND_BYTES_PER_MS;
  const onFlow = ({ status }: { status: string }) => {
    paused = status === 'pause';
  };
  esp32AudioEvents.on(flowEvent, onFlow);
  try {
    for await (const chunk of chunks) {
      for (let offset = 0; offset < chunk.length; offset += FRAME_BYTES) {
        const frame = chunk.subarray(offset, offset + FRAME_BYTES);
        if (!isCurrent()) return false;
        const wait = nextSend - performance.now();
        if (wait > 0) await delay(wait);
        const pauseDeadline = performance.now() + 8000;
        while (isCurrent() && (paused || socket.bufferedAmount >= MAX_SOCKET_QUEUE_BYTES)) {
          if (performance.now() >= pauseDeadline) throw new Error('ESP32 audio delivery stalled');
          await delay(20);
        }
        if (!isCurrent()) return false;
        if (!sendAudioChunkToEsp32(deviceId, frame)) return false;
        nextSend = Math.max(nextSend, performance.now() - BURST_BYTES / SEND_BYTES_PER_MS)
          + frame.length / SEND_BYTES_PER_MS;
      }
    }
    return isCurrent();
  } finally {
    esp32AudioEvents.off(flowEvent, onFlow);
  }
}
