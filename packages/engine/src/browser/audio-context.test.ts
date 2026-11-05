import { describe, expect, expectTypeOf, it } from 'vitest';

import type { AudioContextLike } from '../audio/mixer';
import { createBrowserAudioContext } from './audio-context';

describe('createBrowserAudioContext', () => {
  it('creates a context when Web Audio exists', () => {
    const context = {} as AudioContext;
    const FakeAudioContext = function FakeAudioContext() {
      return context;
    } as unknown as typeof AudioContext;

    expect(createBrowserAudioContext({ AudioContext: FakeAudioContext })).toBe(context);
  });

  it('returns null without Web Audio or when the browser refuses a context', () => {
    const Refusing = function Refusing() {
      throw new Error('too many contexts');
    } as unknown as typeof AudioContext;

    expect(createBrowserAudioContext({})).toBeNull();
    expect(createBrowserAudioContext({ AudioContext: Refusing })).toBeNull();
  });

  // A compile-time check: the type checker fails the build if the real context stops fitting.
  // eslint-disable-next-line vitest/expect-expect
  it('accepts the real AudioContext as the mixer context', () => {
    expectTypeOf<AudioContext>().toExtend<AudioContextLike<AudioBuffer>>();
  });
});
