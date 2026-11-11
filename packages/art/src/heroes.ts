import { PALETTE as P } from './palette';
import { INK, limb } from './svg';

export type HeroName = 'mike' | 'julie';

const LOOKS = {
  mike: { suit: P.blue, suitDark: P.blueDark, panel: P.blueLight, light: P.blueMist, foot: 296 },
  julie: { suit: P.pink, suitDark: P.pinkDark, panel: P.pinkLight, light: '#fff0f6', foot: 278 },
} as const satisfies Record<HeroName, unknown>;

/** How long the jetpack's flame is in each frame. */
const FLAMES = [46, 62, 52, 66] as const;

/**
 * A hero in a space suit with a jetpack and a blaster, facing right. The blaster's muzzle is at
 * (210, 180), twice the game's muzzle (105, 90), so shots leave from its tip. The frames differ in
 * the jetpack's flame only.
 */
export function hero(name: HeroName, frame: number, id: string): string {
  const look = LOOKS[name];
  const L = FLAMES[frame % FLAMES.length] ?? FLAMES[0];
  const foot = look.foot;
  const knee = foot - 34;
  const flame =
    `<path d="M40,240 C40,${String(240 + L * 0.6)} 50,${String(240 + L)} 56,${String(240 + L)} C62,${String(240 + L)} 72,${String(240 + L * 0.6)} 72,240 Z" fill="${P.orange}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>` +
    `<path d="M48,240 C48,${String(240 + L * 0.45)} 53,${String(240 + L * 0.7)} 56,${String(240 + L * 0.7)} C59,${String(240 + L * 0.7)} 64,${String(240 + L * 0.45)} 64,240 Z" fill="#fff1b0"/>`;
  const jetpack =
    `<rect x="24" y="118" width="62" height="118" rx="16" fill="${P.steel}" stroke="${INK}" stroke-width="4"/>` +
    `<rect x="34" y="132" width="14" height="88" rx="7" fill="${P.silver}" opacity="0.8"/>` +
    `<rect x="40" y="228" width="32" height="16" rx="4" fill="${P.slate}" stroke="${INK}" stroke-width="3"/>` +
    `<rect x="78" y="150" width="20" height="12" fill="${P.graphite}"/>`;
  const backLeg =
    limb(`M118,236 L100,${String(knee)} L92,${String(foot - 10)}`, look.suitDark, 24) +
    `<rect x="70" y="${String(foot - 18)}" width="44" height="22" rx="9" fill="${P.graphite}" stroke="${INK}" stroke-width="4"/>`;
  const torso =
    `<path d="M92,140 Q92,124 108,124 L170,124 Q188,124 190,142 L192,226 Q192,246 172,246 L112,246 Q92,246 92,228 Z" fill="${look.suit}" stroke="${INK}" stroke-width="4"/>` +
    `<path d="M100,150 Q102,132 116,132 L130,132" fill="none" stroke="#ffffff" stroke-opacity="0.35" stroke-width="6" stroke-linecap="round"/>` +
    `<rect x="128" y="146" width="50" height="40" rx="9" fill="${look.panel}" stroke="${INK}" stroke-width="3"/>` +
    `<circle cx="166" cy="160" r="6" fill="${look.light}" stroke="${INK}" stroke-width="2"/>` +
    `<rect x="92" y="212" width="100" height="16" fill="${P.graphite}" stroke="${INK}" stroke-width="3"/>` +
    `<rect x="134" y="210" width="20" height="20" rx="4" fill="${P.amber}" stroke="${INK}" stroke-width="3"/>`;
  const frontLeg =
    limb(`M160,238 L196,${String(knee - 8)} L206,${String(foot - 12)}`, look.suit, 26) +
    `<rect x="186" y="${String(foot - 20)}" width="50" height="24" rx="10" fill="${P.graphite}" stroke="${INK}" stroke-width="4"/>`;
  const ponytail =
    name === 'julie'
      ? `<path d="M100,60 C72,52 44,66 34,98 C48,86 64,86 78,92 C62,102 54,120 58,140 C74,116 92,102 108,96 Z" fill="${P.hair}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>` +
        `<path d="M86,66 C66,64 52,74 44,88" fill="none" stroke="${P.hairLight}" stroke-width="4" stroke-linecap="round"/>`
      : '';
  const crest =
    name === 'mike'
      ? `<path d="M118,34 L106,8" stroke="${INK}" stroke-width="4" stroke-linecap="round"/><circle cx="106" cy="8" r="7" fill="${P.red}" stroke="${INK}" stroke-width="3"/>`
      : `<path d="M110,34 Q150,10 192,36" fill="none" stroke="${look.suit}" stroke-width="9" stroke-linecap="round"/>`;
  const helmet =
    `<ellipse cx="148" cy="136" rx="40" ry="11" fill="${P.slate}" stroke="${INK}" stroke-width="3"/>` +
    `<circle cx="150" cy="84" r="60" fill="${P.silver}"/>` +
    `<g clip-path="url(#${id}-helmet)"><circle cx="168" cy="104" r="64" fill="${P.silverShade}"/></g>` +
    `<circle cx="150" cy="84" r="60" fill="none" stroke="${INK}" stroke-width="4"/>` +
    `<path d="M150,50 Q216,46 214,92 Q212,130 162,128 Q128,126 130,92 Q130,54 150,50 Z" fill="url(#${id}-visor)" stroke="${INK}" stroke-width="4"/>` +
    `<path d="M168,64 Q196,62 204,86" fill="none" stroke="#ffffff" stroke-opacity="0.6" stroke-width="7" stroke-linecap="round"/>` +
    `<circle cx="200" cy="104" r="4" fill="#ffffff" opacity="0.5"/>` +
    crest;
  const arm =
    limb('M162,158 L178,196 L196,186', look.suit, 22) +
    `<rect x="168" y="168" width="38" height="24" rx="6" fill="${P.slate}" stroke="${INK}" stroke-width="4"/>` +
    `<rect x="176" y="172" width="16" height="8" rx="2" fill="${P.cyan}"/>` +
    `<rect x="200" y="174" width="12" height="12" rx="2" fill="${P.graphite}" stroke="${INK}" stroke-width="3"/>` +
    `<rect x="180" y="190" width="12" height="16" rx="3" fill="${P.graphite}" stroke="${INK}" stroke-width="3"/>` +
    `<circle cx="194" cy="188" r="12" fill="${P.graphite}" stroke="${INK}" stroke-width="3"/>`;
  return (
    `<defs>` +
    `<clipPath id="${id}-helmet"><circle cx="150" cy="84" r="60"/></clipPath>` +
    `<linearGradient id="${id}-visor" x1="0" y1="0" x2="0.4" y2="1">` +
    `<stop offset="0" stop-color="${P.blueDark}"/><stop offset="1" stop-color="#121a2b"/>` +
    `</linearGradient>` +
    `</defs>` +
    flame +
    jetpack +
    backLeg +
    torso +
    frontLeg +
    ponytail +
    helmet +
    arm
  );
}
