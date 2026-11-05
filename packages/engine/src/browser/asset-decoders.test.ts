import { describe, expect, expectTypeOf, it, vi } from 'vitest';

import { AssetLoadError } from '../assets/loader';
import type { Context2DLike } from '../render/renderer';
import { createBrowserAssetDecoders } from './asset-decoders';

const bitmap = { width: 1, height: 1 } as ImageBitmap;
const buffer = { duration: 1 } as AudioBuffer;

function okResponse(): Response {
  return new Response(new Uint8Array([1, 2, 3]), { status: 200 });
}

async function reasonOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof AssetLoadError) {
      return error.reason;
    }
    throw error;
  }
  throw new Error('expected a rejection');
}

describe('createBrowserAssetDecoders', () => {
  it('decodes images into bitmaps and sounds into audio buffers', async () => {
    const decodeAudioData = vi.fn(() => Promise.resolve(buffer));
    const decoders = createBrowserAssetDecoders({
      audioContext: { decodeAudioData },
      fetch: () => Promise.resolve(okResponse()),
      createImageBitmap: () => Promise.resolve(bitmap),
    });

    await expect(decoders.image('hero.png')).resolves.toBe(bitmap);
    await expect(decoders.audio('shot.wav')).resolves.toBe(buffer);
    expect(decodeAudioData).toHaveBeenCalledOnce();
  });

  it('reports network errors, HTTP errors and undecodable bytes with their reason', async () => {
    const decoders = (fetchResult: () => Promise<Response>) =>
      createBrowserAssetDecoders({
        audioContext: { decodeAudioData: () => Promise.reject(new Error('bad sound')) },
        fetch: fetchResult,
        createImageBitmap: () => Promise.reject(new Error('bad image')),
      });
    const offline = () => Promise.reject(new TypeError('offline'));
    const notFound = () => Promise.resolve(new Response(null, { status: 404 }));
    const ok = () => Promise.resolve(okResponse());

    expect(await reasonOf(decoders(offline).image('a'))).toBe('network');
    expect(await reasonOf(decoders(notFound).image('a'))).toBe('http');
    expect(await reasonOf(decoders(ok).image('a'))).toBe('decode');
    expect(await reasonOf(decoders(ok).audio('a'))).toBe('decode');
  });

  it('uses the global fetch and createImageBitmap by default', async () => {
    vi.stubGlobal('fetch', () => Promise.resolve(okResponse()));
    vi.stubGlobal('createImageBitmap', () => Promise.resolve(bitmap));
    try {
      const decoders = createBrowserAssetDecoders({ audioContext: null });

      await expect(decoders.image('hero.png')).resolves.toBe(bitmap);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('fails every sound as unavailable without Web Audio, before any request', async () => {
    const fetch = vi.fn(() => Promise.resolve(okResponse()));
    const decoders = createBrowserAssetDecoders({ audioContext: null, fetch });

    expect(await reasonOf(decoders.audio('shot.wav'))).toBe('unavailable');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('keeps the message of a non-Error rejection', async () => {
    const decoders = createBrowserAssetDecoders({
      audioContext: null,
      // A non-Error rejection is what this test is about.
      // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
      fetch: () => Promise.reject('offline'),
    });

    await expect(decoders.image('a.png')).rejects.toThrow('a.png: offline');
  });

  // A compile-time check: the type checker fails the build if the contexts stop fitting.
  // eslint-disable-next-line vitest/expect-expect
  it('accepts the real 2D contexts as the renderer context', () => {
    expectTypeOf<CanvasRenderingContext2D>().toExtend<Context2DLike<CanvasImageSource>>();
    expectTypeOf<OffscreenCanvasRenderingContext2D>().toExtend<Context2DLike<CanvasImageSource>>();
  });
});
