import type { DuckOptions, PlayOptions } from '@buzzkill/engine';
import type { GameAudio, GameSound } from '@buzzkill/game';

/**
 * The game's sounds on the mixer (#161): each a little higher or lower than the last, so a burst
 * of shots does not sound like one sample on repeat, and placed between the speakers by where it
 * happened. The variety draws on random numbers of its own, never the simulation's, so the run and
 * its replay are the same with or without sound. An explosion ducks the music for a moment.
 */

/**
 * Mixed into the run's seed for the sounds' own random numbers, apart from the particles', in a
 * run and in its replay alike.
 */
export const SOUND_SEED = 0x85ebca6b;

/** How far the pitch of a sound may wander either way, in cents (a hundredth of a semitone). */
export const PITCH_CENTS = 60;

/** How far toward a speaker a sound at the edge of the world is placed: not quite in it. */
export const PAN_WIDTH = 0.8;

/**
 * How an explosion ducks the music: down to 40 % of its volume in 50 ms, held for a quarter of a
 * second, back in half a second. Explosions come close together in a fight, so the music dips
 * under each and comes up between them rather than staying down.
 */
export const DUCK = {
  depth: 0.4,
  attack: 0.05,
  hold: 0.25,
  release: 0.5,
} as const satisfies DuckOptions;

export interface GameAudioOptions {
  /** A number in [0, 1) for each sound: the renderer's own random numbers. */
  readonly random: () => number;
  /** The width of the world, whose left edge is the left speaker. */
  readonly width: number;
}

/** The part of the mixer the game's sounds use. */
export interface EffectsMixer {
  play(sound: GameSound, options?: PlayOptions): void;
  duck(options: DuckOptions): void;
}

/** The game's audio port on `mixer`. */
export function createGameAudio(mixer: EffectsMixer, options: GameAudioOptions): GameAudio {
  const { random, width } = options;
  return {
    play(sound, x) {
      const cents = (random() * 2 - 1) * PITCH_CENTS;
      mixer.play(sound, {
        rate: 2 ** (cents / 1200),
        pan: x === undefined ? 0 : ((x / width) * 2 - 1) * PAN_WIDTH,
      });
      if (sound === 'explosion') {
        mixer.duck(DUCK);
      }
    },
  };
}
