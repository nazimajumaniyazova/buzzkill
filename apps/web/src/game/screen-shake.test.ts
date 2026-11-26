// @vitest-environment node
import { createEventBus, IDENTITY_CAMERA } from '@buzzkill/engine';
import type { GameEvents } from '@buzzkill/game';
import { beforeEach, describe, expect, it } from 'vitest';

import { createShakeEffects, SHAKE, type ShakeEffects, TRAUMA } from './screen-shake';

describe('createShakeEffects', () => {
  let enabled: boolean;
  let reduced: boolean;
  let events: ReturnType<typeof createEventBus<GameEvents>>;
  let shake: ShakeEffects;

  beforeEach(() => {
    enabled = true;
    reduced = false;
    events = createEventBus<GameEvents>();
    shake = createShakeEffects({ enabled: () => enabled, reducedMotion: () => reduced, seed: 1 });
    shake.listen(events);
  });

  /** How far the camera is from still: its offset and its turn, in shares of their reach. */
  const reach = (time: number): number => {
    const { x, y, angle } = shake.advance(time);
    return Math.max(
      Math.abs(x) / SHAKE.maxOffset,
      Math.abs(y) / SHAKE.maxOffset,
      Math.abs(angle) / SHAKE.maxAngle,
    );
  };

  it('holds still until something happens', () => {
    expect(shake.advance(0)).toEqual(IDENTITY_CAMERA);
    expect(shake.advance(30)).toEqual(IDENTITY_CAMERA);
  });

  it('shakes harder for a hit on the hero than for an explosion, and hardest when the queen falls', () => {
    expect(TRAUMA.playerHit).toBeGreaterThan(TRAUMA.explosion);
    expect(TRAUMA.bossDefeated).toBe(1);
    for (const value of Object.values(TRAUMA)) {
      expect(value).toBeGreaterThan(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  it('shakes on a hit on the hero, within the reach of its trauma squared', () => {
    shake.advance(0);
    events.emit('playerHit', { livesLeft: 2, cause: 'day-1' });

    const camera = shake.advance(0);
    expect(camera).not.toEqual(IDENTITY_CAMERA);
    expect(camera.zoom).toBeGreaterThan(1);
    expect(reach(0)).toBeLessThanOrEqual(TRAUMA.playerHit ** 2);
  });

  it.each([
    ['an explosion', 'explosion', { x: 1, y: 2, variant: 0 }],
    ['a shot on the queen', 'bossHit', { healthLeft: 3, x: 1, y: 2 }],
    ['the queen arriving', 'bossEntered', { maxHealth: 60 }],
    ['her rage', 'bossEnraged', { healthLeft: 20 }],
    ['her fall', 'bossDefeated', { x: 1, y: 2, value: 60 }],
  ] as const)('shakes on %s', (_, type, payload) => {
    shake.advance(0);
    events.emit(type, payload);

    expect(shake.advance(0)).not.toEqual(IDENTITY_CAMERA);
  });

  it('settles back to still as the trauma drains, faster than a second for a hit', () => {
    shake.advance(0);
    events.emit('playerHit', { livesLeft: 2, cause: 'day-1' });

    let time = 0;
    while (shake.advance(time) !== IDENTITY_CAMERA && time < 600) {
      time += 1;
    }
    // A frame moves the shake at most 4 ticks, so these steps of 1 drain it at the full pace.
    expect(time).toBeCloseTo(TRAUMA.playerHit / SHAKE.decay, -0.5);
    expect(time).toBeLessThan(60);
  });

  it('drains at most four ticks of trauma in a frame, and none when time goes back', () => {
    shake.advance(100);
    events.emit('bossDefeated', { x: 1, y: 2, value: 60 });

    shake.advance(10_000);
    expect(shake.advance(10_000)).not.toEqual(IDENTITY_CAMERA);
    shake.advance(5000);
    expect(shake.advance(5000)).not.toEqual(IDENTITY_CAMERA);
  });

  it('does not shake while it is turned off, and drops its trauma when turned off', () => {
    shake.advance(0);
    events.emit('bossDefeated', { x: 1, y: 2, value: 60 });
    enabled = false;

    expect(shake.advance(1)).toEqual(IDENTITY_CAMERA);
    events.emit('playerHit', { livesLeft: 2, cause: 'day-1' });
    enabled = true;
    expect(shake.advance(2)).toEqual(IDENTITY_CAMERA);
  });

  it('does not shake at all while motion is reduced', () => {
    reduced = true;
    shake.advance(0);
    events.emit('playerHit', { livesLeft: 2, cause: 'day-1' });
    expect(shake.advance(0)).toEqual(IDENTITY_CAMERA);

    events.emit('bossDefeated', { x: 1, y: 2, value: 60 });
    reduced = false;
    expect(shake.advance(1)).toEqual(IDENTITY_CAMERA);
  });
});
