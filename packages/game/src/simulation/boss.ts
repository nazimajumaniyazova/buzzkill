/**
 * The boss's fight as pure functions (#152): the state machine of her phases and the schedule of
 * her attacks. The systems feed them her numbers each tick and act on what they return; tests
 * check them directly.
 *
 * Her phases, in the order of a fight:
 *
 * - `entering`: she flies in from the right edge to her post.
 * - `attacking`: she glides between heights, shoots volleys and fans, and calls broods.
 * - `enraged`: under a share of her health she does the same, faster, until it is time to charge.
 * - `windup`, `charging`, `returning`: her charge in the rage. She shakes in place, charges off
 *   the left edge at her height, and flies back in from the right to her post, enraged again.
 * - `defeated`: her health is gone; she sinks among explosions, and is then beaten.
 */

export const BOSS_PHASES = [
  'entering',
  'attacking',
  'enraged',
  'windup',
  'charging',
  'returning',
  'defeated',
] as const;
export type BossPhase = (typeof BOSS_PHASES)[number];

/** What the machine reads of the boss in one tick. */
export interface BossView {
  readonly phase: BossPhase;
  /** Ticks since she entered the phase: 0 in the tick she entered it. */
  readonly phaseTicks: number;
  readonly health: number;
  /** Her health when she arrived. */
  readonly maxHealth: number;
  /** Her left edge and her width, in world pixels. */
  readonly x: number;
  readonly width: number;
}

/** The places and times the machine compares against, at the run's difficulty. */
export interface BossClock {
  /** Where her left edge stops. */
  readonly postX: number;
  readonly rage: { readonly part: number; readonly of: number };
  readonly chargeAfterTicks: number;
  readonly windupTicks: number;
  readonly defeatTicks: number;
}

/** Whether health is down to `part / of` of the most, in whole numbers so a third is exact. */
export function isEnraged(
  health: number,
  maxHealth: number,
  rage: { readonly part: number; readonly of: number },
): boolean {
  return health * rage.of <= maxHealth * rage.part;
}

/**
 * Her phase for this tick: the phase she is in, or the next one when its condition holds. A
 * defeat wins over everything once her health is gone; `beaten` means her defeat has played out
 * and she leaves the world.
 */
export function nextBossPhase(view: BossView, clock: BossClock): BossPhase | 'beaten' {
  const { phase, phaseTicks, x } = view;
  if (phase === 'defeated') {
    return phaseTicks >= clock.defeatTicks ? 'beaten' : 'defeated';
  }
  if (view.health <= 0) {
    return 'defeated';
  }
  switch (phase) {
    case 'entering':
      return x <= clock.postX ? 'attacking' : 'entering';
    case 'attacking':
      return isEnraged(view.health, view.maxHealth, clock.rage) ? 'enraged' : 'attacking';
    case 'enraged':
      return phaseTicks >= clock.chargeAfterTicks ? 'windup' : 'enraged';
    case 'windup':
      return phaseTicks >= clock.windupTicks ? 'charging' : 'windup';
    case 'charging':
      return x + view.width < 0 ? 'returning' : 'charging';
    case 'returning':
      return x <= clock.postX ? 'enraged' : 'returning';
  }
}

/**
 * Which attack is due `phaseTicks` into an attacking phase, if any. The first comes one attack
 * after the phase begins, so she never shoots the moment she arrives or comes back from a charge.
 * Then volleys and fans take turns: a volley is one sting every `gapTicks`, `count` times, each
 * aimed when it leaves; a fan leaves at once.
 */
export function attackAt(
  phaseTicks: number,
  attackTicks: number,
  volley: { readonly count: number; readonly gapTicks: number },
): 'volley' | 'fan' | undefined {
  const attack = Math.floor(phaseTicks / attackTicks);
  const into = phaseTicks - attack * attackTicks;
  if (attack < 1) {
    return undefined;
  }
  if (attack % 2 === 0) {
    return into === 0 ? 'fan' : undefined;
  }
  return into % volley.gapTicks === 0 && into / volley.gapTicks < volley.count
    ? 'volley'
    : undefined;
}

/** Her health at a difficulty's factor (#155): a whole number of hits, never fewer than one. */
export function bossHealthWith(health: number, factor: number): number {
  const scaled = Math.round(health * factor);
  return scaled > 1 ? scaled : 1;
}

/**
 * The vertical speed that takes a sting from `from` to `to` while it flies left at `speed`,
 * no steeper than `maxSlope`. A target that is not ahead gets a straight sting.
 */
export function aimedSlope(
  from: { readonly x: number; readonly y: number },
  to: { readonly x: number; readonly y: number },
  speed: number,
  maxSlope: number,
): number {
  const ahead = from.x - to.x;
  if (ahead <= 0) {
    return 0;
  }
  const slope = ((to.y - from.y) * speed) / ahead;
  return slope > maxSlope ? maxSlope : slope < -maxSlope ? -maxSlope : slope;
}
