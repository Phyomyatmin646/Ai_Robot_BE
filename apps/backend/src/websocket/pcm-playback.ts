import { setTimeout as delay } from 'node:timers/promises';
import { esp32AudioEvents, getActiveEsp32Session, sendPlaybackPcmToEsp32 } from './esp32.gateway.js';

import { ADPCM_PCM_FRAME_BYTES } from './ima-adpcm.js';

const PCM_FRAME_BYTES = 3840;
const BURST_BYTES = 11520;
const MAX_SOCKET_QUEUE_BYTES = 16 * 1024;
// Mono PCM plays at 48 bytes/ms. Send faster so the receiver can recover lost lead.
const SEND_BYTES_PER_MS = 80;

export async function streamRecordedPcm(
  deviceId: string,
  sessionId: string,
  chunks: AsyncIterable<Buffer> | Iterable<Buffer>,
  isCurrent: () => boolean,
): Promise<boolean> {
  const device = getActiveEsp32Session(deviceId);
  if (!device) return false;
  const { socket, playbackCodec } = device;
  const frameBytes = playbackCodec ? ADPCM_PCM_FRAME_BYTES : PCM_FRAME_BYTES;
  const sendBytesPerMs = playbackCodec ? 64 : SEND_BYTES_PER_MS;
  const maxQueuedBytes = playbackCodec ? 4096 : MAX_SOCKET_QUEUE_BYTES;
  const flowEvent = `flow:${deviceId}:${sessionId}`;
  let paused = false;
  let nextSend = performance.now() - BURST_BYTES / sendBytesPerMs;
  const onFlow = ({ status }: { status: string }) => {
    paused = status === 'pause';
  };
  esp32AudioEvents.on(flowEvent, onFlow);
  let trailingByte: number | undefined;
  try {
    for await (const source of chunks) {
      let chunk = source;
      if (playbackCodec && chunk.length) {
        if (trailingByte !== undefined) chunk = Buffer.concat([Buffer.from([trailingByte]), chunk]);
        trailingByte = (chunk.length & 1) ? chunk[chunk.length - 1] : undefined;
        chunk = chunk.subarray(0, chunk.length & ~1);
      }
      for (let offset = 0; offset < chunk.length; offset += frameBytes) {
        const frame = chunk.subarray(offset, offset + frameBytes);
        if (!isCurrent()) return false;
        const wait = nextSend - performance.now();
        if (wait > 0) await delay(wait);
        const pauseDeadline = performance.now() + 8000;
        while (isCurrent() && (paused || socket.bufferedAmount >= maxQueuedBytes)) {
          if (performance.now() >= pauseDeadline) throw new Error('ESP32 audio delivery stalled');
          await delay(20);
        }
        if (!isCurrent()) return false;
        if (!sendPlaybackPcmToEsp32(deviceId, frame, playbackCodec)) return false;
        nextSend = Math.max(nextSend, performance.now() - BURST_BYTES / sendBytesPerMs)
          + frame.length / sendBytesPerMs;
      }
    }
    return isCurrent();
  } finally {
    esp32AudioEvents.off(flowEvent, onFlow);
  }
}
