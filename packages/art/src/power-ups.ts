import { PALETTE as P } from './palette';
import { INK, n } from './svg';

export type PowerUpKind = 'ammo' | 'life' | 'shield' | 'rapidFire';

const C = 32;

/** The halo's extra radius and opacity in each frame: it swells bright and fades as it shrinks. */
const PULSE = [
  [0, 0.2],
  [2, 0.28],
  [4, 0.36],
  [2, 0.24],
] as const;

/** A regular polygon around the centre, its first corner at `start` radians. */
function polygon(sides: number, r: number, start: number): string {
  let d = '';
  for (let i = 0; i < sides; i += 1) {
    const a = start + (i / sides) * Math.PI * 2;
    d += `${i === 0 ? 'M' : 'L'}${String(n(C + Math.cos(a) * r))},${String(n(C + Math.sin(a) * r))} `;
  }
  return `${d}Z`;
}

/** A round, an upright bullet: brass case, cream tip. */
function round(x: number): string {
  return (
    `<rect x="${String(x)}" y="22" width="6" height="18" rx="3" fill="${P.cream}" stroke="${INK}" stroke-width="2"/>` +
    `<rect x="${String(x)}" y="30" width="6" height="10" rx="1.5" fill="${P.amberDark}" stroke="${INK}" stroke-width="2"/>`
  );
}

const SHAPES: Readonly<Record<PowerUpKind, { readonly halo: string; readonly body: string }>> = {
  // A crate of rounds: a square.
  ammo: {
    halo: P.amber,
    body:
      `<rect x="13" y="13" width="38" height="38" rx="7" fill="${P.amber}" stroke="${INK}" stroke-width="3"/>` +
      `<rect x="17" y="17" width="30" height="6" rx="3" fill="${P.cream}" opacity="0.6"/>` +
      round(20) +
      round(29) +
      round(38),
  },
  // A life: a heart.
  life: {
    halo: P.red,
    body:
      `<path d="M32,50 C14,38 10,28 14,21 C18,14 28,14 32,22 C36,14 46,14 50,21 C54,28 50,38 32,50 Z" fill="${P.red}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>` +
      `<path d="M20,22 C22,19 26,19 27,22" fill="none" stroke="${P.cream}" stroke-width="3" stroke-linecap="round"/>`,
  },
  // A shield: a hexagon with a ring inside.
  shield: {
    halo: P.cyan,
    body:
      `<path d="${polygon(6, 21, -Math.PI / 2)}" fill="${P.cyan}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>` +
      `<path d="${polygon(6, 13, -Math.PI / 2)}" fill="${P.blueMist}" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>` +
      `<path d="${polygon(6, 6, -Math.PI / 2)}" fill="${P.white}"/>`,
  },
  // Faster fire: a diamond with a lightning bolt.
  rapidFire: {
    halo: P.violetRim,
    body:
      `<path d="${polygon(4, 22, -Math.PI / 2)}" fill="${P.violet}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>` +
      `<path d="M35,15 L24,34 L31,34 L28,49 L40,28 L33,28 Z" fill="${P.amber}" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>`,
  },
};

/**
 * A power-up in a 64×64 frame, twice its 32×32 box in the world. Each kind has a shape of its own
 * as well as a color, so the colors are never needed to tell them apart. A halo pulses around it
 * over the four frames.
 */
export function powerUp(kind: PowerUpKind, frame: number): string {
  const [grow, opacity] = PULSE[frame % PULSE.length] ?? PULSE[0];
  const { halo, body } = SHAPES[kind];
  return (
    `<circle cx="${String(C)}" cy="${String(C)}" r="${String(26 + grow)}" fill="${halo}" opacity="${String(opacity)}"/>` +
    body
  );
}
