// `test` here is the fast-check wrapper for `test.prop`; plain tests use `it` so the Vitest lint
// rules recognize them.
import { fc, test } from '@fast-check/vitest';
import { describe, expect, it } from 'vitest';

import {
  aimedSlope,
  attackAt,
  BOSS_PHASES,
  type BossClock,
  bossHealthWith,
  type BossPhase,
  type BossView,
  isEnraged,
  nextBossPhase,
} from './boss';

const CLOCK: BossClock = {
  postX: 940,
  rage: { part: 1, of: 3 },
  chargeAfterTicks: 360,
  windupTicks: 45,
  defeatTicks: 90,
};

/** The queen at her post with full health, in `phase` since it began. */
const view = (phase: BossPhase, overrides: Partial<BossView> = {}): BossView => ({
  phase,
  phaseTicks: 0,
  health: 60,
  maxHealth: 60,
  x: 940,
  width: 300,
  ...overrides,
});

const LIVING = BOSS_PHASES.filter((phase) => phase !== 'defeated');

describe('nextBossPhase', () => {
  it('enters until her left edge reaches her post, then attacks', () => {
    expect(nextBossPhase(view('entering', { x: 943 }), CLOCK)).toBe('entering');
    expect(nextBossPhase(view('entering', { x: 940 }), CLOCK)).toBe('attacking');
    expect(nextBossPhase(view('entering', { x: 938 }), CLOCK)).toBe('attacking');
  });

  it('attacks until her health is down to a third, then rages', () => {
    expect(nextBossPhase(view('attacking', { health: 21 }), CLOCK)).toBe('attacking');
    expect(nextBossPhase(view('attacking', { health: 20 }), CLOCK)).toBe('enraged');
  });

  it('in her rage winds up a charge, charges off the left edge and flies back to her post', () => {
    const health = 10;
    expect(nextBossPhase(view('enraged', { health, phaseTicks: 359 }), CLOCK)).toBe('enraged');
    expect(nextBossPhase(view('enraged', { health, phaseTicks: 360 }), CLOCK)).toBe('windup');
    expect(nextBossPhase(view('windup', { health, phaseTicks: 44 }), CLOCK)).toBe('windup');
    expect(nextBossPhase(view('windup', { health, phaseTicks: 45 }), CLOCK)).toBe('charging');
    expect(nextBossPhase(view('charging', { health, x: -300 }), CLOCK)).toBe('charging');
    expect(nextBossPhase(view('charging', { health, x: -301 }), CLOCK)).toBe('returning');
    expect(nextBossPhase(view('returning', { health, x: 941 }), CLOCK)).toBe('returning');
    expect(nextBossPhase(view('returning', { health, x: 940 }), CLOCK)).toBe('enraged');
  });

  it.each(LIVING)('falls from %s the tick her health is gone', (phase) => {
    expect(nextBossPhase(view(phase, { health: 0, x: 500 }), CLOCK)).toBe('defeated');
  });

  it('is beaten once her defeat has played out', () => {
    expect(nextBossPhase(view('defeated', { health: 0, phaseTicks: 89 }), CLOCK)).toBe('defeated');
    expect(nextBossPhase(view('defeated', { health: 0, phaseTicks: 90 }), CLOCK)).toBe('beaten');
  });

  test.prop([
    fc.constantFrom(...BOSS_PHASES),
    fc.nat({ max: 1000 }),
    fc.integer({ min: 1, max: 200 }),
    fc.nat({ max: 200 }),
    fc.integer({ min: -400, max: 1280 }),
  ])(
    'only ever moves along the edges of her fight, and never back from her defeat',
    (phase, phaseTicks, maxHealth, healthRoll, x) => {
      const allowed: Readonly<Record<BossPhase, readonly (BossPhase | 'beaten')[]>> = {
        entering: ['entering', 'attacking', 'defeated'],
        attacking: ['attacking', 'enraged', 'defeated'],
        enraged: ['enraged', 'windup', 'defeated'],
        windup: ['windup', 'charging', 'defeated'],
        charging: ['charging', 'returning', 'defeated'],
        returning: ['returning', 'enraged', 'defeated'],
        defeated: ['defeated', 'beaten'],
      };
      const health = healthRoll % (maxHealth + 1);

      const next = nextBossPhase(view(phase, { phaseTicks, health, maxHealth, x }), CLOCK);

      expect(allowed[phase]).toContain(next);
    },
  );
});

describe('isEnraged', () => {
  it('is true at a third of the most health and below, in whole numbers', () => {
    const rage = { part: 1, of: 3 };

    expect([20, 21].map((health) => isEnraged(health, 60, rage))).toEqual([true, false]);
    expect([33, 34].map((health) => isEnraged(health, 100, rage))).toEqual([true, false]);
  });
});

describe('attackAt', () => {
  const volley = { count: 3, gapTicks: 12 };

  it('waits one attack, then takes turns: a volley of stings a gap apart, then a fan', () => {
    const due = Array.from({ length: 400 }, (_, ticks) => [ticks, attackAt(ticks, 90, volley)])
      .filter(([, attack]) => attack !== undefined)
      .map(([ticks, attack]) => `${String(ticks)} ${String(attack)}`);

    expect(due).toEqual([
      '90 volley',
      '102 volley',
      '114 volley',
      '180 fan',
      '270 volley',
      '282 volley',
      '294 volley',
      '360 fan',
    ]);
  });
});

describe('bossHealthWith', () => {
  it("scales her health by a difficulty's factor to a whole number", () => {
    expect([0.75, 1, 1.25].map((factor) => bossHealthWith(60, factor))).toEqual([45, 60, 75]);
    expect([0.75, 1, 1.25].map((factor) => bossHealthWith(100, factor))).toEqual([75, 100, 125]);
  });

  test.prop([fc.integer({ min: 1, max: 1000 }), fc.double({ min: 0, max: 4, noNaN: true })])(
    'always leaves her at least one hit',
    (health, factor) => {
      expect(bossHealthWith(health, factor)).toBeGreaterThanOrEqual(1);
      expect(Number.isInteger(bossHealthWith(health, factor))).toBe(true);
    },
  );
});

describe('aimedSlope', () => {
  it('climbs or falls just enough to reach the target at a speed to the left', () => {
    // 500 pixels to the left at 5 a tick takes 100 ticks; 100 pixels down in them is 1 a tick.
    expect(aimedSlope({ x: 1000, y: 300 }, { x: 500, y: 400 }, 5, 3)).toBe(1);
    expect(aimedSlope({ x: 1000, y: 300 }, { x: 500, y: 200 }, 5, 3)).toBe(-1);
    expect(aimedSlope({ x: 1000, y: 300 }, { x: 500, y: 300 }, 5, 3)).toBe(0);
  });

  it('is never steeper than the most it may climb or fall', () => {
    expect(aimedSlope({ x: 1000, y: 0 }, { x: 900, y: 700 }, 5, 3)).toBe(3);
    expect(aimedSlope({ x: 1000, y: 700 }, { x: 900, y: 0 }, 5, 3)).toBe(-3);
  });

  it('flies straight at a target that is not ahead of her', () => {
    expect(aimedSlope({ x: 500, y: 300 }, { x: 500, y: 600 }, 5, 3)).toBe(0);
    expect(aimedSlope({ x: 500, y: 300 }, { x: 700, y: 600 }, 5, 3)).toBe(0);
  });
});
