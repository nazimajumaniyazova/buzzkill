import { describe, expect, it } from 'vitest';

import { type BossConfig, type BossPhaseConfig, QUEEN } from './boss';
import { HEROES, RULES, WORLD } from './rules';

const BOSS: BossConfig = QUEEN;
const PHASES: readonly BossPhaseConfig[] = [BOSS.attacking, BOSS.enraged];

describe('QUEEN', () => {
  it("waits at a post within the reach of the hero's shots, inside the world", () => {
    const reach = WORLD.width * RULES.projectile.rangeRatio;

    expect(BOSS.postX).toBeLessThan(reach);
    expect(BOSS.postX + BOSS.hitbox.width).toBeLessThanOrEqual(WORLD.width);
    expect(BOSS.hitbox.height).toBeLessThan(WORLD.height);
  });

  it('is drawn at twice her box, like every enemy', () => {
    expect([BOSS.sprite.frameWidth, BOSS.sprite.frameHeight]).toEqual([
      BOSS.hitbox.width * 2,
      BOSS.hitbox.height * 2,
    ]);
  });

  it('shoots her stings from inside her box', () => {
    const { muzzle, width, height } = BOSS.sting;

    expect(muzzle.x).toBeGreaterThanOrEqual(0);
    expect(muzzle.x + width).toBeLessThanOrEqual(BOSS.hitbox.width);
    expect(muzzle.y).toBeGreaterThanOrEqual(0);
    expect(muzzle.y + height).toBeLessThanOrEqual(BOSS.hitbox.height);
  });

  it('is enraged under a share of her health between none and all of it', () => {
    expect(BOSS.rage.part).toBeGreaterThan(0);
    expect(BOSS.rage.part).toBeLessThan(BOSS.rage.of);
  });

  it('ends a volley before the next attack, and attacks faster in her rage', () => {
    const volleyTicks = (BOSS.volley.count - 1) * BOSS.volley.gapTicks;

    expect(PHASES.filter((phase) => volleyTicks >= phase.attackTicks)).toEqual([]);
    expect(BOSS.enraged.attackTicks).toBeLessThan(BOSS.attacking.attackTicks);
    expect(BOSS.enraged.moveSpeed).toBeGreaterThan(BOSS.attacking.moveSpeed);
  });

  it('sends a brood in her rage before she winds up a charge', () => {
    expect(BOSS.enraged.broodTicks).toBeLessThan(BOSS.enraged.chargeAfterTicks);
  });

  it('leaves the hero a way through every fan where it reaches the hero', () => {
    // A fan leaves her post at the muzzle and flies left at one speed, so its stings spread
    // apart by the difference of their vertical speeds every tick. A difficulty scales both
    // speeds alike, which keeps the gaps.
    const tallest = Math.max(HEROES.male.height, HEROES.female.height);
    const front = RULES.player.start.x + Math.max(HEROES.male.width, HEROES.female.width);
    const ticks = (BOSS.postX + BOSS.sting.muzzle.x - front) / BOSS.sting.speed;
    const narrowest = PHASES.map((phase) =>
      Math.min(...phase.fan.slice(1).map((vy, index) => vy - (phase.fan[index] ?? vy))),
    );

    for (const phase of PHASES) {
      expect(phase.fan).toEqual(phase.fan.toSorted((a, b) => a - b));
    }
    for (const step of narrowest) {
      expect(step * ticks - BOSS.sting.height).toBeGreaterThan(tallest);
    }
  });

  it('aims a volley no steeper than her widest fan, so a sting is never a vertical streak', () => {
    const widest = Math.max(...PHASES.flatMap((phase) => phase.fan.map(Math.abs)));

    expect(BOSS.sting.maxSlope).toBeGreaterThan(0);
    expect(BOSS.sting.maxSlope).toBeLessThanOrEqual(widest);
  });
});
