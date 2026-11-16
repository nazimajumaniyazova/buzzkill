import type { GameEventSource } from '@buzzkill/game';

/**
 * Hit-stop (#158): when a strong blow lands, the picture holds for a moment, so the moment reads.
 * The frame of the blow is drawn, then held; the simulation's ticks go on underneath, so nothing
 * of the run changes and the replays stay the same. Times are wall-clock milliseconds: the hold
 * is a matter of the eye, the same at any game speed.
 */

/** How long each strong moment holds the picture, between 40 and 80 ms. */
export const HIT_STOP_MS = {
  /** A hit on the hero: an insect, a sting or the queen's charge. */
  playerHit: 60,
  /** The queen's rage begins. */
  bossEnraged: 50,
  /** The queen falls. */
  bossDefeated: 80,
} as const;

export interface HitStopOptions {
  /** The hit-stop setting, read at every event and frame. */
  readonly enabled: () => boolean;
  /** Whether motion is reduced, by the setting or the system: then the picture never holds. */
  readonly reducedMotion: () => boolean;
  /** The clock in milliseconds: `performance.now` in the browser, a fake in tests. */
  readonly now: () => number;
}

export interface HitStop {
  /** Follows the run's events, once: which moments hold the picture. */
  listen(events: GameEventSource): void;
  /** Whether this frame holds the last picture instead of drawing. */
  holds(): boolean;
  /** Says a frame was drawn: a hold asked for since the last one starts now. */
  drawn(): void;
}

/** Creates the hit-stop of one run. */
export function createHitStop(options: HitStopOptions): HitStop {
  const { now } = options;
  /** The longest hold asked for since the last frame was drawn, in ms. */
  let pending = 0;
  /** The time the current hold ends; in the past while none holds. */
  let until = Number.NEGATIVE_INFINITY;

  const allowed = (): boolean => options.enabled() && !options.reducedMotion();

  const ask = (ms: number): void => {
    // One at a time: what happens during a hold is let go, not queued after it.
    if (allowed() && now() >= until) {
      pending = Math.max(pending, ms);
    }
  };

  return {
    listen(events) {
      events.on('playerHit', () => {
        ask(HIT_STOP_MS.playerHit);
      });
      events.on('bossEnraged', () => {
        ask(HIT_STOP_MS.bossEnraged);
      });
      events.on('bossDefeated', () => {
        ask(HIT_STOP_MS.bossDefeated);
      });
    },
    holds() {
      if (!allowed()) {
        pending = 0;
        until = Number.NEGATIVE_INFINITY;
        return false;
      }
      return now() < until;
    },
    drawn() {
      if (pending > 0) {
        until = now() + pending;
        pending = 0;
      }
    },
  };
}
