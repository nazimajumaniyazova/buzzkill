import { AssetLoadError } from '@buzzkill/engine';
import type * as browser from '@buzzkill/engine/browser';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { type BootEvent, BootScreen } from './BootScreen';

const decoding = vi.hoisted(() => ({
  /** The error a URL fails with, or undefined for success. */
  fail: (_url: string): Error | undefined => undefined,
  pending: [] as (() => void)[],
}));

// The decoders are replaced; the audio context comes from the real module, so the tests see it.
vi.mock('@buzzkill/engine/browser', async (importOriginal) => ({
  ...(await importOriginal<typeof browser>()),
  createBrowserAssetDecoders: () => {
    const decode = (url: string) =>
      new Promise((resolve, reject) => {
        decoding.pending.push(() => {
          const error = decoding.fail(url);
          if (error === undefined) {
            resolve({ url });
          } else {
            reject(error);
          }
        });
      });
    return { image: decode, audio: decode };
  },
}));

/** Enough of an AudioContext for the mixer: gain nodes, a state, resume and close. */
class FakeAudioContext {
  static created: FakeAudioContext[] = [];
  state = 'suspended';
  destination = {};
  resume = vi.fn(() => {
    this.state = 'running';
    return Promise.resolve();
  });
  close = vi.fn(() => Promise.resolve());
  constructor() {
    FakeAudioContext.created.push(this);
  }
  createGain() {
    return { gain: { value: 1 }, connect: () => undefined };
  }
}

/** Settles `count` pending decodes, or all of them. */
async function settle(count = Infinity): Promise<void> {
  await act(async () => {
    for (let i = 0; i < count && decoding.pending.length > 0; i += 1) {
      decoding.pending.shift()?.();
      await Promise.resolve();
    }
  });
}

function setup() {
  const onEvent = vi.fn<(event: BootEvent) => void>();
  const onRetry = vi.fn();
  const view = render(
    <BootScreen attempt={0} failures={null} onEvent={onEvent} onRetry={onRetry} />,
  );
  /** The first event the boot reported. */
  const event = (): BootEvent | undefined => onEvent.mock.calls[0]?.[0];
  return { onEvent, onRetry, event, ...view };
}

describe('BootScreen', () => {
  beforeEach(() => {
    decoding.fail = () => undefined;
    decoding.pending.length = 0;
    FakeAudioContext.created = [];
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows the loading progress, then reports the sprites and a mixer', async () => {
    const { container, event, onEvent } = setup();
    const progress = screen.getByRole('progressbar', { name: 'Loading' });
    expect(progress).toHaveAttribute('value', '0');
    expect(await axe(container)).toHaveNoViolations();

    await settle(2);
    expect(Number(progress.getAttribute('value'))).toBeGreaterThan(0);

    await settle();
    expect(onEvent).toHaveBeenCalledOnce();
    const booted = event();
    expect(booted?.type).toBe('booted');
    if (booted?.type !== 'booted') {
      return;
    }
    expect(booted.assets.sprites.projectile).toBeDefined();
    // jsdom has no Web Audio: the mixer is silent.
    expect(booted.assets.audio.available).toBe(false);
  });

  it('reports what failed to load, then lists it with a retry', async () => {
    decoding.fail = (url) =>
      url.includes('projectile') ? new AssetLoadError('http', `${url}: HTTP 404`) : undefined;
    const { event, onEvent, onRetry, rerender } = setup();
    await settle();

    const failed = event();
    expect(failed?.type).toBe('bootFailed');
    if (failed?.type !== 'bootFailed') {
      return;
    }
    expect(failed.failures.map((failure) => [failure.id, failure.reason])).toEqual([
      ['projectile', 'http'],
    ]);

    rerender(
      <BootScreen attempt={0} failures={failed.failures} onEvent={onEvent} onRetry={onRetry} />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('The game could not load');
    expect(screen.getByRole('listitem')).toHaveTextContent(
      'projectile.png: the server returned an error',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('loads again on a new attempt', async () => {
    const { onEvent, onRetry, rerender } = setup();
    await settle();
    expect(onEvent).toHaveBeenCalledOnce();

    rerender(<BootScreen attempt={1} failures={null} onEvent={onEvent} onRetry={onRetry} />);
    expect(screen.getByRole('progressbar', { name: 'Loading' })).toBeInTheDocument();
    await settle();

    expect(onEvent).toHaveBeenCalledTimes(2);
  });

  it('boots without sound when the sounds cannot load', async () => {
    decoding.fail = (url) =>
      url.endsWith('.wav') ? new AssetLoadError('unavailable', 'no Web Audio') : undefined;
    const { event } = setup();
    await settle();

    expect(event()?.type).toBe('booted');
  });

  it('decodes on an audio context created before any gesture and starts it on unlock', async () => {
    vi.stubGlobal('AudioContext', FakeAudioContext);
    const { event } = setup();
    await settle();

    const booted = event();
    expect(booted?.type).toBe('booted');
    if (booted?.type !== 'booted') {
      return;
    }
    expect(FakeAudioContext.created).toHaveLength(1);
    expect(booted.assets.audio.available).toBe(true);
    expect(booted.assets.audio.unlocked).toBe(false);

    await booted.assets.audio.unlock();

    expect(FakeAudioContext.created[0]?.resume).toHaveBeenCalledOnce();
    expect(booted.assets.audio.unlocked).toBe(true);
  });

  it('closes the audio context when the load fails or the screen leaves before the end', async () => {
    vi.stubGlobal('AudioContext', FakeAudioContext);
    decoding.fail = () => new Error('offline');
    const first = setup();
    await settle();
    expect(FakeAudioContext.created[0]?.close).toHaveBeenCalledOnce();
    first.unmount();

    decoding.fail = () => undefined;
    const second = setup();
    second.unmount();
    await settle();

    expect(FakeAudioContext.created).toHaveLength(2);
    expect(FakeAudioContext.created[1]?.close).toHaveBeenCalledOnce();
    expect(second.onEvent).not.toHaveBeenCalled();
  });
});
