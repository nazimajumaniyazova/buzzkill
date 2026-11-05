import { describe, expect, it, vi } from 'vitest';

import {
  type AssetDecoders,
  AssetLoadError,
  type AssetLoadResult,
  type AssetManifest,
  loadAssets,
  type LoadProgress,
} from './loader';

interface FakeImage {
  readonly src: string;
}
interface FakeSound {
  readonly sound: string;
}

/** Decoders that settle only when the test releases them. */
function createDecoders(failing: Record<string, unknown> = {}) {
  const pending: (() => void)[] = [];
  const decode = <T>(url: string, make: () => T) =>
    new Promise<T>((resolve, reject) => {
      pending.push(() => {
        if (url in failing) {
          // The test decides what is thrown, Error or not.
          // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
          reject(failing[url]);
        } else {
          resolve(make());
        }
      });
    });
  const decoders: AssetDecoders<FakeImage, FakeSound> = {
    image: (url) => decode(url, () => ({ src: url })),
    audio: (url) => decode(url, () => ({ sound: url })),
  };
  return {
    decoders,
    /** Settles the pending decodes, the last requested first. */
    async releaseAll() {
      while (pending.length > 0) {
        pending.pop()?.();
        await Promise.resolve();
      }
    },
  };
}

/** The success branch of a result; fails the test otherwise. */
function loaded<M extends AssetManifest>(result: AssetLoadResult<M, FakeImage, FakeSound>) {
  if (!result.ok) {
    throw new Error(`expected a successful load, got ${JSON.stringify(result.failures)}`);
  }
  return result;
}

const MANIFEST = {
  hero: { kind: 'image', url: 'hero.png' },
  enemy: { kind: 'image', url: 'enemy.png' },
  shot: { kind: 'audio', url: 'shot.wav' },
} as const;

describe('loadAssets', () => {
  it('loads every entry, typed by kind, and reports progress from 0 to 1', async () => {
    const fake = createDecoders();
    const progress: LoadProgress[] = [];

    const loading = loadAssets(MANIFEST, fake.decoders, {
      onProgress: (p) => {
        progress.push(p);
      },
    });
    await fake.releaseAll();
    const { assets, skipped } = loaded(await loading);

    const hero: FakeImage = assets.hero;
    const shot: FakeSound = assets.shot;
    expect(hero).toEqual({ src: 'hero.png' });
    expect(shot).toEqual({ sound: 'shot.wav' });
    expect(skipped).toEqual([]);
    expect(progress.map((p) => p.fraction)).toEqual([0, 1 / 3, 2 / 3, 1]);
    expect(progress.at(-1)).toEqual({ loaded: 3, total: 3, fraction: 1 });
  });

  it('returns every failure with its reason, in manifest order, instead of throwing', async () => {
    const fake = createDecoders({
      'shot.wav': new AssetLoadError('decode', 'shot.wav: not a sound'),
      'hero.png': new Error('boom'),
    });

    const loading = loadAssets(MANIFEST, fake.decoders);
    await fake.releaseAll();

    expect(await loading).toEqual({
      ok: false,
      failures: [
        { id: 'hero', kind: 'image', url: 'hero.png', reason: 'unknown', message: 'boom' },
        {
          id: 'shot',
          kind: 'audio',
          url: 'shot.wav',
          reason: 'decode',
          message: 'shot.wav: not a sound',
        },
      ],
    });
  });

  it('runs without optional assets that fail and lists them as skipped', async () => {
    const fake = createDecoders({ 'music.ogg': new AssetLoadError('unavailable', 'no audio') });
    const manifest = {
      hero: { kind: 'image', url: 'hero.png' },
      music: { kind: 'audio', url: 'music.ogg', optional: true },
    } as const;

    const loading = loadAssets(manifest, fake.decoders);
    await fake.releaseAll();
    const { assets, skipped } = loaded(await loading);

    const music: FakeSound | undefined = assets.music;
    expect(music).toBeUndefined();
    expect(skipped.map((failure) => [failure.id, failure.reason])).toEqual([
      ['music', 'unavailable'],
    ]);
  });

  it('describes a non-Error rejection by its string form', async () => {
    const fake = createDecoders({ 'hero.png': 'offline' });

    const loading = loadAssets({ hero: { kind: 'image', url: 'hero.png' } }, fake.decoders);
    await fake.releaseAll();
    const result = await loading;

    expect(result.ok ? undefined : result.failures[0]?.message).toBe('offline');
  });

  it('finishes an empty manifest at once with full progress', async () => {
    const onProgress = vi.fn();

    const result = await loadAssets({}, createDecoders().decoders, { onProgress });

    expect(result).toEqual({ ok: true, assets: {}, skipped: [] });
    expect(onProgress).toHaveBeenCalledExactlyOnceWith({ loaded: 0, total: 0, fraction: 1 });
  });
});
