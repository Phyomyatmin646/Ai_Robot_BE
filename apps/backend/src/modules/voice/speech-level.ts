// PCM levels for 24 kHz signed 16-bit mono speech.
const SAMPLE_RATE = 24_000;
const TARGET_RMS = 7_500;
const NOISE_FLOOR_SQUARED = 400 ** 2;
const PEAK_KNEE = 23_000;
const PEAK_HEADROOM = 6_000;
const RMS_ATTACK = 1 - Math.exp(-1 / (SAMPLE_RATE * 0.012));
const RMS_RELEASE = 1 - Math.exp(-1 / (SAMPLE_RATE * 0.18));
const GAIN_REDUCTION = 1 - Math.exp(-1 / (SAMPLE_RATE * 0.01));
const GAIN_INCREASE = 1 - Math.exp(-1 / (SAMPLE_RATE * 0.06));

export class SpeechLeveler {
  private power = 0;
  private gain = 1;

  apply(pcm: Buffer): Buffer {
    const output = Buffer.from(pcm);
    for (let offset = 0; offset + 1 < pcm.length; offset += 2) {
      const sample = pcm.readInt16LE(offset);
      const square = sample * sample;
      this.power += (square - this.power) * (square > this.power ? RMS_ATTACK : RMS_RELEASE);

      const target = this.power > NOISE_FLOOR_SQUARED
        ? Math.max(1, Math.min(2.5, TARGET_RMS / Math.sqrt(this.power)))
        : 1;
      this.gain += (target - this.gain) * (target < this.gain ? GAIN_REDUCTION : GAIN_INCREASE);

      let magnitude = Math.abs(sample) * this.gain;
      if (magnitude > PEAK_KNEE) {
        const excess = magnitude - PEAK_KNEE;
        magnitude = PEAK_KNEE + (PEAK_HEADROOM * excess) / (PEAK_HEADROOM + excess);
      }
      output.writeInt16LE(Math.round(sample < 0 ? -magnitude : magnitude), offset);
    }
    return output;
  }
}

const recordedSpeech = new WeakMap<Buffer, Buffer>();

export function levelRecordedSpeech(pcm: Buffer): Buffer {
  let leveled = recordedSpeech.get(pcm);
  if (!leveled) {
    leveled = new SpeechLeveler().apply(pcm);
    recordedSpeech.set(pcm, leveled);
  }
  return leveled;
}
