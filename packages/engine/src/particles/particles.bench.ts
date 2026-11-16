import { describe, test } from 'vitest';

import { createRng } from '../math/rng';
import { createParticleSystem, defineParticleBurst } from './particles';

/**
 * Cost of the particles (#156): one frame's update of a full system, with the particles that die
 * in it replaced, as the game's events keep replacing them in a busy fight. 640 is all the game
 * can hold at once, its two layers full (384 behind the insects, 256 in front), so a run never
 * costs more. Run with `pnpm bench`.
 */

const CAPACITY = 640;

/** Every way, with gravity, drag and a shrink: each particle takes every step of the update. */
const BURST = defineParticleBurst({
  count: 8,
  speed: { min: 0.5, max: 4 },
  direction: 0,
  spread: 2 * Math.PI,
  drift: { x: -1, y: 0 },
  life: { min: 10, max: 40 },
  size: { min: 2, max: 6 },
  endSize: 0.2,
  gravity: 0.1,
  drag: 0.05,
  colors: ['#fff', '#f5c242', '#e8655a'],
  style: 0,
});

/** CodSpeed's CPU simulation (ADR-0012) runs code many times slower; CI fails only on a hang. */
const BENCH_TIMEOUT = 600_000;

describe('particles', () => {
  test('a frame of a full system', { timeout: BENCH_TIMEOUT }, async ({ bench }) => {
    const particles = createParticleSystem<number>({ capacity: CAPACITY, rng: createRng(1) });
    const refill = (): void => {
      while (particles.count < CAPACITY) {
        particles.emit(BURST, 640, 360);
      }
    };
    // Ages spread over the lives, as in play, rather than a whole system born in one frame.
    for (let tick = 0; tick < 60; tick += 1) {
      refill();
      particles.update(1);
    }

    await bench(`update ${String(CAPACITY)} particles and replace the dead`, () => {
      particles.update(1);
      refill();
    }).run();
  });
});
