// @vitest-environment node
import type { DuckOptions, PlayOptions } from '@buzzkill/engine';
import type { GameSound } from '@buzzkill/game';
import { describe, expect, it, vi } from 'vitest';

import { createGameAudio, DUCK, PAN_WIDTH, PITCH_CENTS } from './game-audio';

/** A mixer that records how each sound was asked to play. */
function fakeMixer() {
  return {
    play: vi.fn<(sound: GameSound, options?: PlayOptions) => void>(),
    duck: vi.fn<(options: DuckOptions) => void>(),
  };
}

/** The pitch of a playback rate, in cents. */
const cents = (rate: number | undefined): number => Math.log2(rate ?? 1) * 1200;

describe('createGameAudio', () => {
  it('varies the pitch of each sound a little, from its own random numbers', () => {
    const mixer = fakeMixer();
    const draws = [0, 1, 0.5, 0.25];
    const audio = createGameAudio(mixer, { random: () => draws.shift() ?? 0.5, width: 1000 });

    for (let i = 0; i < 4; i += 1) {
      audio.play('shot');
    }

    const pitches = mixer.play.mock.calls.map(([, options]) => cents(options?.rate));
    expect(pitches[0]).toBeCloseTo(-PITCH_CENTS);
    expect(pitches[1]).toBeCloseTo(PITCH_CENTS);
    expect(pitches[2]).toBeCloseTo(0);
    expect(pitches[3]).toBeCloseTo(-PITCH_CENTS / 2);
    expect(PITCH_CENTS).toBeGreaterThan(0);
    expect(PITCH_CENTS).toBeLessThanOrEqual(100);
  });

  it('ducks the music for each explosion, and for nothing else', () => {
    const mixer = fakeMixer();
    const audio = createGameAudio(mixer, { random: () => 0.5, width: 1000 });

    audio.play('shot', 100);
    audio.play('explosion', 400);
    audio.play('hit', 100);
    audio.play('explosion', 600);

    expect(mixer.duck.mock.calls).toEqual([[DUCK], [DUCK]]);
    // Down fast, back slower, and still heard while down.
    expect(DUCK.attack).toBeLessThan(DUCK.release);
    expect(DUCK.depth).toBeGreaterThan(0);
    expect(DUCK.depth).toBeLessThan(1);
    expect(DUCK.attack + DUCK.hold + DUCK.release).toBeLessThanOrEqual(1.5);
  });

  it('pans each sound by where it happened across the world, and the rest to the middle', () => {
    const mixer = fakeMixer();
    const audio = createGameAudio(mixer, { random: () => 0.5, width: 1000 });

    audio.play('shot', 0);
    audio.play('explosion', 500);
    audio.play('pickup', 1000);
    audio.play('bossPhase');

    expect(mixer.play.mock.calls.map(([sound, options]) => [sound, options?.pan])).toEqual([
      ['shot', -PAN_WIDTH],
      ['explosion', 0],
      ['pickup', PAN_WIDTH],
      ['bossPhase', 0],
    ]);
    expect(PAN_WIDTH).toBeGreaterThan(0);
    expect(PAN_WIDTH).toBeLessThan(1);
  });
});
