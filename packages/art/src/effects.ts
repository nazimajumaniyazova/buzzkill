import { PALETTE as P } from './palette';
import { blob, INK, n, random } from './svg';

export type ExplosionKind = 'fire' | 'smoke';

/**
 * The radius of the fireball, of the smoke ring and the smoke's opacity in each of the 9 frames:
 * the game keeps an explosion for 9 frames of 4 ticks (`RULES.explosion`), so the count is a rule.
 */
const FIRE: Readonly<Record<ExplosionKind, readonly number[]>> = {
  fire: [32, 78, 112, 126, 116, 96, 66, 36, 0],
  smoke: [24, 52, 74, 84, 76, 58, 38, 18, 0],
};
const SMOKE_OPACITY: Readonly<Record<ExplosionKind, readonly number[]>> = {
  fire: [0, 0.2, 0.45, 0.8, 1, 0.95, 0.75, 0.5, 0.25],
  smoke: [0.3, 0.7, 0.95, 1, 1, 0.9, 0.7, 0.45, 0.2],
};
const SMOKE_RADIUS = [40, 80, 112, 136, 150, 160, 168, 174, 178] as const;

/** An explosion in a 400×400 frame: a flash, a fireball with sparks, then smoke that drifts up. */
export function explosion(kind: ExplosionKind, frame: number): string {
  const c = 200;
  const fireR = FIRE[kind][frame] ?? 0;
  const smokeO = SMOKE_OPACITY[kind][frame] ?? 0;
  const smokeR = SMOKE_RADIUS[frame] ?? 0;
  const grey = kind === 'fire' ? [P.slate, P.steel] : ['#4a5262', '#9aa4b4'];
  let out = '';
  if (smokeO > 0) {
    const next = random(7);
    let puffs = '';
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * Math.PI * 2 + next() * 0.5;
      const d = smokeR * (0.45 + next() * 0.15);
      const r = smokeR * (0.36 + next() * 0.12);
      const x = c + Math.cos(a) * d;
      const y = c + Math.sin(a) * d - frame * 4;
      puffs += `<path d="${blob(x, y, r, { points: 8, jitter: 0.25, seed: 20 + i })}" fill="${String(grey[0])}" stroke="${INK}" stroke-width="3"/>`;
      puffs += `<path d="${blob(x - r * 0.2, y - r * 0.25, r * 0.55, { points: 7, jitter: 0.2, seed: 40 + i })}" fill="${String(grey[1])}" opacity="0.7"/>`;
    }
    out += `<g opacity="${String(smokeO)}">${puffs}</g>`;
  }
  if (fireR > 0) {
    out += `<path d="${blob(c, c, fireR, { points: 12, jitter: 0.32, seed: 3 })}" fill="${P.red}" stroke="${INK}" stroke-width="4"/>`;
    out += `<path d="${blob(c, c, fireR * 0.74, { points: 11, jitter: 0.3, seed: 5 })}" fill="${P.orange}"/>`;
    out += `<path d="${blob(c, c, fireR * 0.5, { points: 9, jitter: 0.28, seed: 9 })}" fill="${P.amber}"/>`;
    if (frame < 4) {
      out += `<path d="${blob(c, c, fireR * 0.28, { points: 8, jitter: 0.25, seed: 11 })}" fill="${P.cream}"/>`;
    }
  }
  if (frame >= 1 && frame <= 4) {
    const next = random(13);
    let sparks = '';
    for (let i = 0; i < 10; i += 1) {
      const a = next() * Math.PI * 2;
      const r0 = (fireR || 60) * (0.9 + frame * 0.15);
      const r1 = r0 + 22 + next() * 14;
      sparks += `<path d="M${String(n(c + Math.cos(a) * r0))},${String(n(c + Math.sin(a) * r0))} L${String(n(c + Math.cos(a) * r1))},${String(n(c + Math.sin(a) * r1))}" stroke="${P.amber}" stroke-width="5" stroke-linecap="round"/>`;
    }
    out += `<g opacity="${String(n(1 - (frame - 1) * 0.22))}">${sparks}</g>`;
  }
  if (frame === 0) {
    let spikes = '';
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * Math.PI * 2;
      const point = (angle: number, r: number): string =>
        `${String(n(c + Math.cos(angle) * r))},${String(n(c + Math.sin(angle) * r))}`;
      spikes += `<path d="M${point(a - 0.15, 30)} L${point(a, 70)} L${point(a + 0.15, 30)} Z" fill="${P.cream}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>`;
    }
    out = spikes + out;
  }
  return out;
}

/** The shot in a 20×6 frame, twice its 10×3 hitbox. */
export function shot(): string {
  return (
    `<rect x="0.5" y="0.5" width="19" height="5" rx="2.5" fill="${P.amber}" stroke="${P.amberDark}" stroke-width="1"/>` +
    `<rect x="4" y="2" width="13" height="2" rx="1" fill="#fffbe6"/>`
  );
}

/**
 * The shot as drawn in flight, 60×12: the bright head of `shot` at x 40 with a tail that fades
 * behind it, so a 10×3 shot is visible on the screen. Only the head is the hitbox.
 */
export function shotTrail(id: string): string {
  return (
    `<defs><linearGradient id="${id}-tail" x1="0" y1="0" x2="1" y2="0">` +
    `<stop offset="0" stop-color="${P.amber}" stop-opacity="0"/><stop offset="1" stop-color="${P.amber}" stop-opacity="0.75"/>` +
    `</linearGradient></defs>` +
    `<rect x="0" y="4" width="44" height="4" rx="2" fill="url(#${id}-tail)"/>` +
    `<rect x="38" y="1.5" width="22" height="9" rx="4.5" fill="${P.amber}" opacity="0.35"/>` +
    `<rect x="40" y="3" width="20" height="6" rx="3" fill="${P.amber}"/>` +
    `<rect x="44" y="4.5" width="13" height="3" rx="1.5" fill="#fffbe6"/>`
  );
}
