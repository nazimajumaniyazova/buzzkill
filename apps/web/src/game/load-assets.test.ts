import { AssetLoadError } from '@buzzkill/engine';
import type * as browser from '@buzzkill/engine/browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SOUNDS } from '../assets/manifest.gen';
import { GAME_ASSETS } from './assets';
import { loadGameAssets } from './load-assets';

const decoding = vi.hoisted(() => ({
  /** The error a URL fails with, or undefined for success. */
  fail: (_url: string): Error | undefined => undefined,
  /** The audio context the decoders were given. */
  audioContext: undefined as AudioContext | null | undefined,
  /** Every URL a decoder was asked for. */
  requested: [] as string[],
}));

vi.mock('@buzzkill/engine/browser', async (importOriginal) => ({
  ...(await importOriginal<typeof browser>()),
  createBrowserAssetDecoders: ({ audioContext }: { audioContext: AudioContext | null }) => {
    decoding.audioContext = audioContext;
    const decode = (url: string) => {
      decoding.requested.push(url);
      const error = decoding.fail(url);
      return error === undefined ? Promise.resolve({ url }) : Promise.reject(error);
    };
    return { image: decode, audio: decode };
  },
}));

/** Enough of an AudioContext for the mixer: gain nodes, a state and resume. */
function createFakeAudioContext() {
  const context = {
    state: 'suspended',
    destination: {},
    resume: vi.fn(() => {
      context.state = 'running';
      return Promise.resolve();
    }),
    close: vi.fn(() => Promise.resolve()),
    createGain: () => ({ gain: { value: 1 }, connect: () => undefined }),
  };
  return context;
}

describe('loadGameAssets', () => {
  beforeEach(() => {
    decoding.fail = () => undefined;
    decoding.audioContext = undefined;
    decoding.requested = [];
  });

  it('loads every file with progress, then builds the sprites and the mixer', async () => {
    const progress: number[] = [];

    const result = await loadGameAssets(null, (fraction) => {
      progress.push(fraction);
    });

    expect(progress).toHaveLength(Object.keys(GAME_ASSETS).length + 1);
    expect(progress[0]).toBe(0);
    expect(progress.at(-1)).toBe(1);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.assets.sprites.heroes.male.atlas.frames.length).toBeGreaterThan(0);
    // Without an audio context the mixer is silent.
    expect(result.assets.audio.available).toBe(false);
  });

  it('reports what failed to load', async () => {
    decoding.fail = (url) =>
      url.includes('creatures') ? new AssetLoadError('http', `${url}: HTTP 404`) : undefined;

    const result = await loadGameAssets(null, () => undefined);

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.failures.map((failure) => [failure.id, failure.reason])).toEqual([
      ['creatures', 'http'],
    ]);
  });

  it('runs without sound when the sounds cannot load', async () => {
    decoding.fail = (url) =>
      /\.(ogg|wav)$/.test(url) ? new AssetLoadError('unavailable', 'no Web Audio') : undefined;

    const result = await loadGameAssets(null, () => undefined);

    expect(result.ok).toBe(true);
  });

  it('decodes the WAV of a sound whose Ogg file the browser cannot decode', async () => {
    decoding.fail = (url) =>
      url.endsWith('.ogg') ? new AssetLoadError('decode', `${url}: no Ogg`) : undefined;

    const result = await loadGameAssets(null, () => undefined);

    expect(result.ok).toBe(true);
    const sounds = decoding.requested.filter((url) => /\.(ogg|wav)$/.test(url));
    const count = Object.keys(SOUNDS).length;
    expect(sounds.filter((url) => url.endsWith('.wav'))).toHaveLength(count);
    expect(sounds).toHaveLength(count * 2);
  });

  it("decodes the sounds on the page's context, which the mixer then plays through", async () => {
    const context = createFakeAudioContext();

    const result = await loadGameAssets(context as unknown as AudioContext, () => undefined);

    expect(decoding.audioContext).toBe(context);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.assets.audio.available).toBe(true);
    expect(result.assets.audio.unlocked).toBe(false);
    await result.assets.audio.unlock();
    expect(context.resume).toHaveBeenCalledOnce();
    expect(result.assets.audio.unlocked).toBe(true);
  });
});
