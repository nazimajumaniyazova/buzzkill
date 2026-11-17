// @vitest-environment node
import { createEventBus } from '@buzzkill/engine';
import type { GameEvents } from '@buzzkill/game';
import { beforeEach, describe, expect, it } from 'vitest';

import { createHitStop, HIT_STOP_MS, type HitStop } from './hit-stop';

describe('createHitStop', () => {
  let now: number;
  let enabled: boolean;
  let reduced: boolean;
  let events: ReturnType<typeof createEventBus<GameEvents>>;
  let hitStop: HitStop;

  beforeEach(() => {
    now = 1000;
    enabled = true;
    reduced = false;
    events = createEventBus<GameEvents>();
    hitStop = createHitStop({
      enabled: () => enabled,
      reducedMotion: () => reduced,
      now: () => now,
    });
    hitStop.listen(events);
  });

  /** A frame: whether it held the last picture; a frame that draws reports it. */
  const frame = (): boolean => {
    if (hitStop.holds()) {
      return true;
    }
    hitStop.drawn();
    return false;
  };

  it('draws every frame until something strong happens', () => {
    expect([frame(), frame(), frame()]).toEqual([false, false, false]);
  });

  it('draws the frame of a hit on the hero, then holds it for its time while the clock goes on', () => {
    events.emit('playerHit', { livesLeft: 2 });

    expect(frame()).toBe(false);
    now += 16;
    expect(frame()).toBe(true);
    now += HIT_STOP_MS.playerHit - 17;
    expect(frame()).toBe(true);
    now += 1;
    expect(frame()).toBe(false);
  });

  it('holds longest when the queen falls, and takes the longest of one frame', () => {
    events.emit('bossEnraged', { healthLeft: 20 });
    events.emit('bossDefeated', { x: 1, y: 2, value: 60 });
    frame();

    now += HIT_STOP_MS.bossDefeated - 1;
    expect(frame()).toBe(true);
    now += 1;
    expect(frame()).toBe(false);
    expect(HIT_STOP_MS.bossDefeated).toBeGreaterThan(HIT_STOP_MS.playerHit);
    for (const ms of Object.values(HIT_STOP_MS)) {
      expect(ms).toBeGreaterThanOrEqual(40);
      expect(ms).toBeLessThanOrEqual(80);
    }
  });

  it('runs one hit-stop at a time: what happens while it holds is let go', () => {
    events.emit('playerHit', { livesLeft: 2 });
    frame();
    now += 10;
    events.emit('bossDefeated', { x: 1, y: 2, value: 60 });

    now += HIT_STOP_MS.playerHit;
    expect(frame()).toBe(false);
    now += 16;
    expect(frame()).toBe(false);

    events.emit('bossEnraged', { healthLeft: 20 });
    frame();
    now += 1;
    expect(frame()).toBe(true);
  });

  it('never holds while it is off, and lets go of a hold when turned off', () => {
    events.emit('playerHit', { livesLeft: 2 });
    frame();
    enabled = false;
    now += 1;
    expect(frame()).toBe(false);

    events.emit('playerHit', { livesLeft: 1 });
    frame();
    enabled = true;
    now += 1;
    expect(frame()).toBe(false);
  });

  it('never holds while motion is reduced', () => {
    reduced = true;
    events.emit('bossDefeated', { x: 1, y: 2, value: 60 });
    frame();
    now += 1;

    expect(frame()).toBe(false);
  });
});
