export const ADPCM_CODEC = 'ima-adpcm';
export const ADPCM_PCM_FRAME_BYTES = 11520;

const STEPS = [
  7, 8, 9, 10, 11, 12, 13, 14, 16, 17, 19, 21, 23, 25, 28, 31,
  34, 37, 41, 45, 50, 55, 60, 66, 73, 80, 88, 97, 107, 118, 130, 143,
  157, 173, 190, 209, 230, 253, 279, 307, 337, 371, 408, 449, 494, 544, 598, 658,
  724, 796, 876, 963, 1060, 1166, 1282, 1411, 1552, 1707, 1878, 2066, 2272, 2499, 2749, 3024,
  3327, 3660, 4026, 4428, 4871, 5358, 5894, 6484, 7132, 7845, 8630, 9493, 10442, 11487,
  12635, 13899, 15289, 16818, 18500, 20350, 22385, 24623, 27086, 29794, 32767,
];
const INDEX_DELTA = [-1, -1, -1, -1, 2, 4, 6, 8];

// Each WebSocket frame carries its own predictor, step index and pad flag.
// PCM samples are encoded low nibble first. The predictor is not a sample in the output.
export function encodeImaAdpcm(pcm: Buffer): Buffer {
  const count = pcm.length / 2;
  const frame = Buffer.alloc(4 + Math.ceil(count / 2));
  let predictor = pcm.readInt16LE(0);
  const firstDelta = count > 1 ? Math.abs(pcm.readInt16LE(2) - predictor) : 0;
  let index = 0;
  while (index < 88 && STEPS[index] < firstDelta) index++;
  frame.writeInt16LE(predictor, 0);
  frame[2] = index;
  frame[3] = count % 2;

  for (let i = 0; i < count; i++) {
    const step = STEPS[index];
    let delta = pcm.readInt16LE(i * 2) - predictor;
    let code = delta < 0 ? 8 : 0;
    delta = Math.abs(delta);
    let adjustment = step >> 3;
    if (delta >= step) {
      code |= 4;
      delta -= step;
      adjustment += step;
    }
    const half = step >> 1;
    if (delta >= half) {
      code |= 2;
      delta -= half;
      adjustment += half;
    }
    const quarter = step >> 2;
    if (delta >= quarter) {
      code |= 1;
      adjustment += quarter;
    }

    const offset = 4 + (i >> 1);
    frame[offset] |= code << ((i & 1) * 4);
    predictor = Math.max(-32768, Math.min(32767, predictor + (code & 8 ? -adjustment : adjustment)));
    index = Math.max(0, Math.min(88, index + INDEX_DELTA[code & 7]));
  }
  return frame;
}
