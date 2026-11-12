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
  const requested: string[] = [];
  const decode = <T>(url: string, make: () => T) =>
    new Promise<T>((resolve, reject) => {
      requested.push(url);
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
    /**
     * Settles the pending decodes, the last requested first, until none is left. Waiting a task
     * between them lets the loader request the decodes that follow a failure, such as a fallback.
     */
    async releaseAll() {
      for (;;) {
        await new Promise((resolve) => setTimeout(resolve, 0));
        const release = pending.pop();
        if (release === undefined) {
          return;
        }
        release();
      }
    },
    /** Every URL a decoder was asked for, in order. */
    requested,
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

  describe('with a fallback file', () => {
    const manifest = {
      shot: { kind: 'audio', url: 'shot.ogg', fallbackUrl: 'shot.wav' },
    } as const;

    it('loads the fallback when the first file does not decode', async () => {
      const fake = createDecoders({ 'shot.ogg': new AssetLoadError('decode', 'shot.ogg: no Ogg') });

      const loading = loadAssets(manifest, fake.decoders);
      await fake.releaseAll();
      const { assets, skipped } = loaded(await loading);

      expect(assets.shot).toEqual({ sound: 'shot.wav' });
      expect(skipped).toEqual([]);
      expect(fake.requested).toEqual(['shot.ogg', 'shot.wav']);
    });

    it('never requests the fallback when the first file decodes', async () => {
      const fake = createDecoders();

      const loading = loadAssets(manifest, fake.decoders);
      await fake.releaseAll();

      expect(loaded(await loading).assets.shot).toEqual({ sound: 'shot.ogg' });
      expect(fake.requested).toEqual(['shot.ogg']);
    });

    it('reports a failed download without trying the fallback from the same server', async () => {
      const fake = createDecoders({
        'shot.ogg': new AssetLoadError('network', 'shot.ogg: offline'),
      });

      const loading = loadAssets(manifest, fake.decoders);
      await fake.releaseAll();

      expect(await loading).toEqual({
        ok: false,
        failures: [
          {
            id: 'shot',
            kind: 'audio',
            url: 'shot.ogg',
            reason: 'network',
            message: 'shot.ogg: offline',
          },
        ],
      });
      expect(fake.requested).toEqual(['shot.ogg']);
    });

    it('reports the fallback and both messages when neither file decodes', async () => {
      const fake = createDecoders({
        'shot.ogg': new AssetLoadError('decode', 'shot.ogg: no Ogg'),
        'shot.wav': new AssetLoadError('decode', 'shot.wav: no WAV'),
      });

      const loading = loadAssets(manifest, fake.decoders);
      await fake.releaseAll();

      expect(await loading).toEqual({
        ok: false,
        failures: [
          {
            id: 'shot',
            kind: 'audio',
            url: 'shot.wav',
            reason: 'decode',
            message: 'shot.ogg: no Ogg; then shot.wav: no WAV',
          },
        ],
      });
    });
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
