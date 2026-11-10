// @vitest-environment node
import type { AssetFailure } from '@buzzkill/engine';
import { describe, expect, it, vi } from 'vitest';

import type { GameAssetsResult } from '../game/load-assets';
import { createGameLoader, type GameLoad } from './game-loader';
import type { GameAssets } from './machine';

// The loader hands the assets over without reading into them, so an empty object does.
const assets = { sprites: {}, audio: {} } as GameAssets;

const failure: AssetFailure = {
  id: 'projectile',
  kind: 'image',
  url: '/projectile.png',
  reason: 'http',
  message: 'HTTP 404',
};

/** A promise and the functions that settle it, for steps the test takes one at a time. */
function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  let reject: (reason: unknown) => void = () => undefined;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** Lets every settled promise run its callbacks. */
const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

/** A loader over a chunk and a load of the files that the test settles. */
function setup() {
  const chunk = deferred<{ loadGameAssets: typeof loadGameAssets }>();
  const files = deferred<GameAssetsResult>();
  let report: (fraction: number) => void = () => undefined;
  const loadGameAssets = vi.fn((_context: AudioContext | null, onProgress: typeof report) => {
    report = onProgress;
    return files.promise;
  });
  const importChunk = vi.fn(() => chunk.promise);
  const resume = vi.fn(() => Promise.resolve());
  const context = { resume } as unknown as AudioContext;
  const createAudioContext = vi.fn(() => context);
  const loader = createGameLoader({ importChunk, createAudioContext });
  const seen: GameLoad[] = [];
  loader.subscribe(() => {
    seen.push(loader.getState());
  });
  return {
    loader,
    chunk,
    files,
    importChunk,
    loadGameAssets,
    context,
    resume,
    createAudioContext,
    seen,
    progress: (fraction: number) => {
      report(fraction);
    },
  };
}

describe('createGameLoader', () => {
  it('stays idle and downloads nothing until asked', () => {
    const { loader, importChunk, createAudioContext } = setup();

    expect(loader.getState()).toEqual({ status: 'idle' });
    expect(importChunk).not.toHaveBeenCalled();
    expect(createAudioContext).not.toHaveBeenCalled();
  });

  it('downloads the chunk, then the files with progress, and ends ready with the assets', async () => {
    const { loader, chunk, files, loadGameAssets, context, seen, progress } = setup();

    loader.load();
    expect(loader.getState()).toEqual({ status: 'loading', fraction: 0 });

    chunk.resolve({ loadGameAssets });
    await flush();
    expect(loadGameAssets).toHaveBeenCalledWith(context, expect.any(Function));
    progress(0);
    progress(0.5);
    expect(loader.getState()).toEqual({ status: 'loading', fraction: 0.5 });

    files.resolve({ ok: true, assets });
    await flush();
    expect(loader.getState()).toEqual({ status: 'ready', assets });
    expect(seen.map((load) => load.status)).toEqual(['loading', 'loading', 'loading', 'ready']);
  });

  it('loads once however often it is asked: a hover, a click and Start share one download', async () => {
    const { loader, chunk, files, importChunk, loadGameAssets } = setup();

    loader.load();
    loader.load();
    chunk.resolve({ loadGameAssets });
    await flush();
    loader.load();
    files.resolve({ ok: true, assets });
    await flush();
    loader.load();

    expect(importChunk).toHaveBeenCalledOnce();
    expect(loadGameAssets).toHaveBeenCalledOnce();
    expect(loader.getState().status).toBe('ready');
  });

  it('reports a chunk that did not download, and downloads it again when asked', async () => {
    const { loader, chunk, importChunk, loadGameAssets } = setup();
    importChunk.mockReturnValueOnce(Promise.reject(new TypeError('Failed to fetch')));

    loader.load();
    await flush();
    expect(loader.getState()).toEqual({ status: 'codeFailed' });
    expect(loadGameAssets).not.toHaveBeenCalled();

    loader.load();
    expect(loader.getState()).toEqual({ status: 'loading', fraction: 0 });
    chunk.resolve({ loadGameAssets });
    await flush();
    expect(importChunk).toHaveBeenCalledTimes(2);
    expect(loadGameAssets).toHaveBeenCalledOnce();
  });

  it('reports the files that failed, and loads them again when asked', async () => {
    const { loader, chunk, files, loadGameAssets } = setup();
    loadGameAssets.mockResolvedValueOnce({ ok: false, failures: [failure] });

    loader.load();
    chunk.resolve({ loadGameAssets });
    await flush();
    expect(loader.getState()).toEqual({ status: 'assetsFailed', failures: [failure] });

    loader.load();
    files.resolve({ ok: true, assets });
    await flush();
    expect(loadGameAssets).toHaveBeenCalledTimes(2);
    expect(loader.getState()).toEqual({ status: 'ready', assets });
  });

  it('creates one audio context for the visit, at the first load, before the chunk arrives', async () => {
    const { loader, chunk, loadGameAssets, createAudioContext, context } = setup();
    loadGameAssets.mockResolvedValueOnce({ ok: false, failures: [failure] });

    loader.load();
    expect(createAudioContext).toHaveBeenCalledOnce();
    chunk.resolve({ loadGameAssets });
    await flush();
    loader.load();
    await flush();

    expect(createAudioContext).toHaveBeenCalledOnce();
    expect(loadGameAssets.mock.calls.map(([given]) => given)).toEqual([context, context]);
  });

  it('starts the audio inside the gesture, while the chunk is still on its way', () => {
    const { loader, resume } = setup();

    loader.load();
    loader.unlockAudio();

    expect(resume).toHaveBeenCalledOnce();
  });

  it('creates the context to start it when no load came first', () => {
    const { loader, createAudioContext, resume } = setup();

    loader.unlockAudio();

    expect(createAudioContext).toHaveBeenCalledOnce();
    expect(resume).toHaveBeenCalledOnce();
  });

  it('keeps quiet when the browser refuses to start the audio or has no Web Audio', async () => {
    const refuse = vi.fn(() => Promise.reject(new DOMException('No gesture', 'NotAllowedError')));
    const loader = createGameLoader({
      importChunk: () => new Promise(() => undefined),
      createAudioContext: () => ({ resume: refuse }) as unknown as AudioContext,
    });
    loader.unlockAudio();
    await flush();
    expect(refuse).toHaveBeenCalledOnce();

    const silent = createGameLoader({
      importChunk: () => new Promise(() => undefined),
      createAudioContext: () => null,
    });
    expect(() => {
      silent.unlockAudio();
    }).not.toThrow();
  });
});
