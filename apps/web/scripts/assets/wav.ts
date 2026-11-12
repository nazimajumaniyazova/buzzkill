const HEADER_BYTES = 44;
const BYTES_PER_SAMPLE = 2;

/**
 * Encodes decoded audio as a 16-bit PCM WAV file, the format every browser decodes. Each channel
 * holds samples from -1 to 1; louder ones are clamped. The fallback for browsers that cannot
 * decode the Ogg file (ADR-0016).
 */
export function encodeWav(channels: readonly Float32Array[], sampleRate: number): Uint8Array {
  const length = channels[0]?.length ?? 0;
  if (channels.some((channel) => channel.length !== length)) {
    throw new RangeError('encodeWav: every channel must have the same number of samples');
  }
  const blockAlign = channels.length * BYTES_PER_SAMPLE;
  const dataBytes = length * blockAlign;
  const bytes = new Uint8Array(HEADER_BYTES + dataBytes);
  const view = new DataView(bytes.buffer);
  const ascii = (offset: number, text: string): void => {
    for (let index = 0; index < text.length; index += 1) {
      view.setUint8(offset + index, text.charCodeAt(index));
    }
  };

  ascii(0, 'RIFF');
  view.setUint32(4, bytes.byteLength - 8, true);
  ascii(8, 'WAVE');
  ascii(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels.length, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, BYTES_PER_SAMPLE * 8, true);
  ascii(36, 'data');
  view.setUint32(40, dataBytes, true);

  let offset = HEADER_BYTES;
  for (let index = 0; index < length; index += 1) {
    for (const channel of channels) {
      const sample = Math.min(1, Math.max(-1, channel[index] ?? 0));
      view.setInt16(offset, Math.round(sample < 0 ? sample * 0x8000 : sample * 0x7fff), true);
      offset += BYTES_PER_SAMPLE;
    }
  }
  return bytes;
}
