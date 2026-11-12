// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { encodeWav } from './wav';

const text = (bytes: Uint8Array, start: number, length: number) =>
  String.fromCharCode(...bytes.subarray(start, start + length));

describe('encodeWav', () => {
  it('writes a 16-bit PCM header for the channels and the sample rate', () => {
    const left = new Float32Array([0, 0.5, -0.5]);
    const right = new Float32Array([1, -1, 0]);

    const wav = encodeWav([left, right], 44_100);
    const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);

    expect(wav.byteLength).toBe(44 + 3 * 2 * 2);
    expect(text(wav, 0, 4)).toBe('RIFF');
    expect(view.getUint32(4, true)).toBe(wav.byteLength - 8);
    expect(text(wav, 8, 4)).toBe('WAVE');
    expect(text(wav, 12, 4)).toBe('fmt ');
    expect(view.getUint32(16, true)).toBe(16);
    expect(view.getUint16(20, true)).toBe(1);
    expect(view.getUint16(22, true)).toBe(2);
    expect(view.getUint32(24, true)).toBe(44_100);
    expect(view.getUint32(28, true)).toBe(44_100 * 2 * 2);
    expect(view.getUint16(32, true)).toBe(4);
    expect(view.getUint16(34, true)).toBe(16);
    expect(text(wav, 36, 4)).toBe('data');
    expect(view.getUint32(40, true)).toBe(3 * 2 * 2);
  });

  it('interleaves the channels and scales samples to 16 bits, clamping out-of-range ones', () => {
    const wav = encodeWav([new Float32Array([0, 0.5, 2]), new Float32Array([1, -1, -3])], 8_000);
    const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);

    const samples = Array.from({ length: 6 }, (_, index) => view.getInt16(44 + index * 2, true));
    expect(samples).toEqual([0, 32_767, 16_384, -32_768, 32_767, -32_768]);
  });

  it('refuses channels of different lengths', () => {
    expect(() => encodeWav([new Float32Array(2), new Float32Array(3)], 8_000)).toThrow(RangeError);
  });
});
