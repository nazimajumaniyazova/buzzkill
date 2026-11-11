import { PALETTE as P } from './palette';
import { INK, limb, lines, n } from './svg';

/** One wing, pointing back from its root at (0, 0); the art rotates it to flap. */
const WING = 'M0,0 C18,-20 66,-34 100,-26 C114,-22 112,-6 98,-1 C70,8 26,9 0,0 Z';
const WING_VEINS = 'M8,-2 C34,-14 64,-20 96,-18 M12,1 C42,-2 72,-6 98,-8';
const LONG_WING = 'M0,0 C30,-12 110,-22 150,-14 C160,-10 156,0 146,2 C100,8 30,8 0,0 Z';
const MOTH_WING = 'M0,0 C8,-40 58,-82 118,-72 C138,-68 134,-42 114,-22 C82,4 30,12 0,0 Z';

interface WingStyle {
  readonly shape?: string;
  readonly scaleX?: number;
  readonly scaleY?: number;
  readonly fill: string;
  readonly opacity: number;
  readonly veins?: boolean;
}

function wing(x: number, y: number, angle: number, style: WingStyle): string {
  const { shape = WING, scaleX = 1, scaleY = scaleX, fill, opacity, veins = true } = style;
  return (
    `<g transform="translate(${String(x)},${String(y)}) rotate(${String(n(angle))}) scale(${String(scaleX)},${String(scaleY)})">` +
    `<path d="${shape}" fill="${fill}" fill-opacity="${String(opacity)}" stroke="${INK}" stroke-opacity="0.55" stroke-width="3" stroke-linejoin="round"/>` +
    (veins
      ? `<path d="${WING_VEINS}" fill="none" stroke="${INK}" stroke-opacity="0.25" stroke-width="2"/>` +
        `<path d="M14,-6 C38,-18 66,-24 90,-22" fill="none" stroke="#ffffff" stroke-opacity="0.7" stroke-width="3" stroke-linecap="round"/>`
      : '') +
    `</g>`
  );
}

/** Where the frame is in one beat of the wings, as an angle. */
const phaseOf = (frame: number, frames: number): number => (frame / frames) * Math.PI * 2;

/**
 * The insect's body bobbing with its wings, moved down by `drop` so that a wing at the top of its
 * beat stays inside the frame.
 */
const bobbing = (phase: number, inner: string, drop = 0): string =>
  `<g transform="translate(0,${String(n(drop + Math.sin(phase) * 3))})">${inner}</g>`;

// ------------------------------------------------------------------------------------------ day

/** A striped wasp with glowing eyes and feelers: the first day enemy of the rework, 253×207. */
export function wasp(frame: number, frames: number, id: string): string {
  const phase = phaseOf(frame, frames);
  const angle = -26 + Math.cos(phase) * 40;
  const legs = (dx: number): string =>
    lines([
      `M${String(108 + dx)},130 l-12,22 l8,24`,
      `M${String(124 + dx)},134 l-4,26 l10,20`,
      `M${String(140 + dx)},130 l10,24 l16,12`,
    ]);
  return (
    `<defs>` +
    `<clipPath id="${id}-abd"><ellipse cx="184" cy="122" rx="54" ry="33"/></clipPath>` +
    `<clipPath id="${id}-head"><circle cx="76" cy="108" r="27"/></clipPath>` +
    `</defs>` +
    bobbing(
      phase,
      wing(126, 90, angle + 14, { scaleX: 0.75, fill: '#cfe7ff', opacity: 0.45 }) +
        `<g opacity="0.75">${legs(10)}</g>` +
        `<g transform="rotate(-12,184,122)">` +
        `<ellipse cx="184" cy="122" rx="54" ry="33" fill="${P.amber}"/>` +
        `<g clip-path="url(#${id}-abd)">` +
        `<ellipse cx="196" cy="136" rx="54" ry="30" fill="${P.amberDark}" opacity="0.55"/>` +
        [154, 180, 206]
          .map((x) => `<rect x="${String(x)}" y="80" width="13" height="90" fill="${INK}"/>`)
          .join('') +
        `<ellipse cx="170" cy="105" rx="30" ry="9" fill="#ffffff" opacity="0.45"/>` +
        `</g>` +
        `<ellipse cx="184" cy="122" rx="54" ry="33" fill="none" stroke="${INK}" stroke-width="4"/>` +
        `<path d="M234,114 L256,122 L234,130 Z" fill="${INK}"/>` +
        `</g>` +
        `<ellipse cx="148" cy="116" rx="9" ry="7" fill="${INK}"/>` +
        `<ellipse cx="122" cy="112" rx="31" ry="27" fill="${P.shell}" stroke="${INK}" stroke-width="4"/>` +
        `<ellipse cx="114" cy="100" rx="15" ry="7" fill="#ffffff" opacity="0.22"/>` +
        lines(['M82,84 C78,62 64,48 46,44', 'M90,86 C92,64 82,46 66,34'], 3.5) +
        `<circle cx="46" cy="44" r="5" fill="${P.cyan}" stroke="${INK}" stroke-width="2"/>` +
        `<circle cx="66" cy="34" r="5" fill="${P.cyan}" stroke="${INK}" stroke-width="2"/>` +
        `<circle cx="76" cy="108" r="27" fill="${P.amber}"/>` +
        `<g clip-path="url(#${id}-head)"><circle cx="90" cy="122" r="30" fill="${P.amberDark}" opacity="0.6"/></g>` +
        `<circle cx="76" cy="108" r="27" fill="none" stroke="${INK}" stroke-width="4"/>` +
        `<ellipse cx="66" cy="101" rx="14" ry="18" fill="${P.cyan}" stroke="${INK}" stroke-width="3"/>` +
        `<ellipse cx="61" cy="93" rx="4" ry="6" fill="#ffffff" opacity="0.85"/>` +
        lines(['M54,120 q-12,4 -9,13', 'M60,125 q-7,8 0,15'], 4) +
        legs(0) +
        wing(122, 88, angle, { scaleX: 0.85, fill: '#e8f4ff', opacity: 0.55 }),
      16,
    )
  );
}

/** A horned beetle in a teal shell that opens to fly: the big day enemy, 273×273. */
export function beetle(frame: number, frames: number, id: string): string {
  const phase = phaseOf(frame, frames);
  const flap = Math.cos(phase);
  const shellPath = 'M0,0 C22,-34 96,-44 136,-12 C116,8 44,12 0,0 Z';
  const shellCase = (angle: number, fill: string, light: string): string =>
    `<g transform="translate(118,128) rotate(${String(n(angle))})">` +
    `<path d="${shellPath}" fill="${fill}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>` +
    `<path d="M18,-16 C46,-32 86,-34 116,-16" fill="none" stroke="${light}" stroke-width="5" stroke-linecap="round"/>` +
    `<circle cx="70" cy="-14" r="7" fill="${P.amber}" stroke="${INK}" stroke-width="2.5"/>` +
    `<circle cx="100" cy="-8" r="5" fill="${P.amber}" stroke="${INK}" stroke-width="2.5"/>` +
    `</g>`;
  return (
    `<defs><clipPath id="${id}-body"><ellipse cx="162" cy="176" rx="74" ry="50"/></clipPath></defs>` +
    bobbing(
      phase,
      wing(150, 124, -40 + flap * 40, { scaleX: 1, fill: '#e8f4ff', opacity: 0.45 }) +
        shellCase(-34 + flap * 10, P.tealDark, P.teal) +
        `<g opacity="0.8">${lines(['M150,214 l-8,22 l10,18', 'M178,214 l6,22 l16,12'])}</g>` +
        `<ellipse cx="162" cy="176" rx="74" ry="50" fill="${P.teal}"/>` +
        `<g clip-path="url(#${id}-body)">` +
        `<ellipse cx="180" cy="196" rx="74" ry="44" fill="${P.tealDark}" opacity="0.7"/>` +
        [150, 184, 214]
          .map(
            (x) =>
              `<path d="M${String(x)},140 q-8,36 0,80" fill="none" stroke="${INK}" stroke-opacity="0.5" stroke-width="3"/>`,
          )
          .join('') +
        `</g>` +
        `<ellipse cx="162" cy="176" rx="74" ry="50" fill="none" stroke="${INK}" stroke-width="4"/>` +
        `<ellipse cx="110" cy="168" rx="36" ry="32" fill="${P.tealDark}" stroke="${INK}" stroke-width="4"/>` +
        `<ellipse cx="102" cy="156" rx="16" ry="8" fill="${P.tealLight}" opacity="0.6"/>` +
        `<path d="M68,160 C58,138 60,118 76,102 C76,122 80,140 92,158 Z" fill="${P.graphite}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>` +
        `<path d="M70,136 C68,124 70,116 74,110" fill="none" stroke="${P.steel}" stroke-width="3" stroke-linecap="round"/>` +
        `<circle cx="76" cy="180" r="26" fill="${P.body}" stroke="${INK}" stroke-width="4"/>` +
        `<circle cx="66" cy="178" r="8" fill="${P.amber}" stroke="${INK}" stroke-width="2.5"/>` +
        `<circle cx="64" cy="175" r="2.5" fill="#ffffff"/>` +
        lines(['M54,190 q-10,6 -6,14', 'M96,204 l-10,24 l6,20', 'M120,208 l-2,26 l10,16']) +
        shellCase(-18 + flap * 8, P.teal, P.tealLight) +
        wing(146, 120, -24 + flap * 36, { scaleX: 1.1, fill: '#f2f8ff', opacity: 0.55 }),
      12,
    )
  );
}

/** A blue dragonfly with two pairs of long wings beating out of step: a fast day enemy, 266×207. */
export function dragonfly(frame: number, frames: number, id: string): string {
  const phase = phaseOf(frame, frames);
  const front = -12 + Math.cos(phase) * 24;
  const hind = -12 + Math.cos(phase + Math.PI / 2) * 24;
  const tail = 'M112,112 Q186,112 254,126';
  const rings = [134, 152, 170, 188, 206, 224, 240]
    .map((x) => {
      const t = (x - 112) / 142;
      const y = 112 + 14 * t * t;
      return `<path d="M${String(x)},${String(n(y - 7))} l0,14" stroke="${INK}" stroke-width="3"/>`;
    })
    .join('');
  return (
    `<defs><clipPath id="${id}-eye"><circle cx="52" cy="104" r="25"/></clipPath></defs>` +
    bobbing(
      phase,
      wing(96, 98, hind + 8, { shape: LONG_WING, scaleX: 0.95, fill: '#d8ecff', opacity: 0.42 }) +
        wing(86, 96, front + 8, { shape: LONG_WING, scaleX: 0.9, fill: '#d8ecff', opacity: 0.42 }) +
        limb(tail, P.blue, 13) +
        rings +
        `<path d="M118,108 Q186,108 250,121" fill="none" stroke="${P.blueMist}" stroke-width="3" stroke-linecap="round" opacity="0.8"/>` +
        lines(['M84,124 l-6,18 l6,12', 'M96,126 l2,20 l8,10']) +
        `<ellipse cx="90" cy="112" rx="28" ry="21" fill="${P.blue}" stroke="${INK}" stroke-width="4"/>` +
        `<path d="M80,96 l6,32 M96,94 l4,34" stroke="${P.blueDark}" stroke-width="5"/>` +
        `<ellipse cx="84" cy="102" rx="12" ry="6" fill="#ffffff" opacity="0.35"/>` +
        `<circle cx="52" cy="104" r="25" fill="${P.teal}"/>` +
        `<g clip-path="url(#${id}-eye)"><circle cx="62" cy="116" r="24" fill="${P.tealDark}" opacity="0.7"/></g>` +
        `<circle cx="52" cy="104" r="25" fill="none" stroke="${INK}" stroke-width="4"/>` +
        `<ellipse cx="44" cy="94" rx="7" ry="9" fill="#ffffff" opacity="0.75"/>` +
        `<path d="M34,124 q-4,8 4,12" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>` +
        wing(94, 96, hind, { shape: LONG_WING, fill: '#eef7ff', opacity: 0.55 }) +
        wing(84, 94, front, { shape: LONG_WING, fill: '#eef7ff', opacity: 0.55 }),
      20,
    )
  );
}

// ---------------------------------------------------------------------------------------- night

/** A firefly with a lamp that pulses: the bright night enemy, 271×194. */
export function firefly(frame: number, frames: number, id: string): string {
  const phase = phaseOf(frame, frames);
  const angle = -30 + Math.cos(phase) * 36;
  const glow = 0.62 + 0.38 * Math.cos(phase);
  return (
    `<defs>` +
    `<radialGradient id="${id}-glow" cx="0.5" cy="0.5" r="0.5">` +
    `<stop offset="0" stop-color="#f4ff9a" stop-opacity="${String(n(0.85 * glow))}"/>` +
    `<stop offset="0.45" stop-color="#b9ff5a" stop-opacity="${String(n(0.35 * glow))}"/>` +
    `<stop offset="1" stop-color="#b9ff5a" stop-opacity="0"/>` +
    `</radialGradient>` +
    `<clipPath id="${id}-abd"><ellipse cx="172" cy="118" rx="52" ry="25"/></clipPath>` +
    `</defs>` +
    bobbing(
      phase,
      `<circle cx="212" cy="120" r="${String(n(40 + 12 * glow))}" fill="url(#${id}-glow)"/>` +
        wing(134, 84, angle + 12, { scaleX: 0.72, fill: '#d9dcff', opacity: 0.4 }) +
        lines(
          ['M124,132 l-6,18 l10,16', 'M140,136 l2,20 l12,12', 'M156,134 l10,16 l16,6'],
          4.5,
          P.violetRim,
        ) +
        `<ellipse cx="172" cy="118" rx="52" ry="25" fill="${P.violetBody}"/>` +
        `<g clip-path="url(#${id}-abd)">` +
        `<rect x="196" y="80" width="40" height="80" fill="${P.glow}"/>` +
        `<rect x="206" y="80" width="40" height="80" fill="${P.glowCore}" opacity="${String(n(0.5 + 0.5 * glow))}"/>` +
        [150, 172, 194]
          .map(
            (x) =>
              `<path d="M${String(x)},96 q-6,22 0,44" fill="none" stroke="${INK}" stroke-opacity="0.6" stroke-width="3"/>`,
          )
          .join('') +
        `</g>` +
        `<ellipse cx="172" cy="118" rx="52" ry="25" fill="none" stroke="${INK}" stroke-width="4"/>` +
        `<path d="M132,100 C150,94 176,93 196,98" fill="none" stroke="${P.violetRim}" stroke-width="3" stroke-linecap="round" opacity="0.8"/>` +
        `<g transform="rotate(${String(n(-8 + 4 * Math.cos(phase)))},108,96)">` +
        `<path d="M104,92 C122,70 170,70 196,92 C178,104 132,108 104,100 Z" fill="${P.violet}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>` +
        `<path d="M118,86 C138,78 164,78 182,88" fill="none" stroke="#c4b6f2" stroke-width="4" stroke-linecap="round"/>` +
        `</g>` +
        lines(['M66,104 C52,86 40,76 18,72', 'M74,98 C66,74 54,60 36,50'], 3, P.violetRim) +
        [
          [30, 73],
          [46, 80],
          [44, 56],
          [58, 70],
        ]
          .map(
            ([x, y]) => `<circle cx="${String(x)}" cy="${String(y)}" r="3" fill="${P.violetRim}"/>`,
          )
          .join('') +
        `<circle cx="72" cy="114" r="17" fill="${P.violetBody}" stroke="${INK}" stroke-width="4"/>` +
        `<path d="M62,102 C68,98 76,98 82,102" fill="none" stroke="${P.violetRim}" stroke-width="3" stroke-linecap="round"/>` +
        `<circle cx="64" cy="112" r="8" fill="#141821"/>` +
        `<circle cx="61" cy="109" r="3" fill="#cfd8ff"/>` +
        `<path d="M70,96 C76,80 104,76 118,90 C112,106 84,112 70,104 Z" fill="${P.red}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>` +
        `<ellipse cx="96" cy="94" rx="9" ry="6" fill="${INK}"/>` +
        wing(128, 82, angle, { scaleX: 0.78, fill: '#e6e8ff', opacity: 0.5 }),
      14,
    )
  );
}

/** A moth whose wings carry glowing eye spots: the slow night enemy, 266×188. */
export function moth(frame: number, frames: number, id: string): string {
  const phase = phaseOf(frame, frames);
  const angle = 6 + Math.cos(phase) * 26;
  const mothWing = (a: number, scale: number, fill: string, spots: boolean): string =>
    `<g transform="translate(122,96) rotate(${String(n(a))}) scale(${String(scale)})">` +
    `<path d="${MOTH_WING}" fill="${fill}" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"/>` +
    `<path d="M14,-8 C34,-40 70,-62 110,-62" fill="none" stroke="${P.lavender}" stroke-width="5" stroke-linecap="round" opacity="0.7"/>` +
    (spots
      ? `<circle cx="84" cy="-40" r="18" fill="url(#${id}-spot)"/>` +
        `<circle cx="84" cy="-40" r="10" fill="#8ff3ff" stroke="${INK}" stroke-width="2.5"/>` +
        `<circle cx="84" cy="-40" r="4" fill="${INK}"/>` +
        `<circle cx="48" cy="-18" r="6" fill="${P.lavender}" stroke="${INK}" stroke-width="2"/>`
      : '') +
    `</g>`;
  return (
    `<defs><radialGradient id="${id}-spot"><stop offset="0.4" stop-color="#8ff3ff" stop-opacity="0.6"/><stop offset="1" stop-color="#8ff3ff" stop-opacity="0"/></radialGradient></defs>` +
    bobbing(
      phase,
      mothWing(angle + 16, 0.82, '#4e4372', false) +
        `<ellipse cx="166" cy="120" rx="48" ry="23" fill="#8a7ca8" stroke="${INK}" stroke-width="4"/>` +
        [148, 168, 188]
          .map(
            (x) =>
              `<path d="M${String(x)},100 q-5,20 0,40" fill="none" stroke="${INK}" stroke-opacity="0.45" stroke-width="3"/>`,
          )
          .join('') +
        `<path d="M138,104 C160,98 186,99 206,106" fill="none" stroke="${P.lavender}" stroke-width="3" stroke-linecap="round"/>` +
        lines(['M104,124 l-8,18 l8,12', 'M120,128 l0,20 l10,10'], 4, P.violetRim) +
        `<circle cx="114" cy="110" r="24" fill="#b3a7cc" stroke="${INK}" stroke-width="4"/>` +
        `<path d="M98,96 C108,90 122,90 130,96" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" opacity="0.6"/>` +
        lines(['M86,102 C80,80 68,64 50,56', 'M92,98 C92,74 84,56 70,44'], 3, P.lavender) +
        [
          'M76,82 l-8,-4',
          'M70,72 l-8,-2',
          'M62,64 l-7,0',
          'M88,74 l-8,-6',
          'M86,62 l-7,-5',
          'M80,52 l-6,-4',
        ]
          .map(
            (d) =>
              `<path d="${d}" stroke="${P.lavender}" stroke-width="2.5" stroke-linecap="round"/>`,
          )
          .join('') +
        `<circle cx="84" cy="114" r="16" fill="#8a7ca8" stroke="${INK}" stroke-width="4"/>` +
        `<circle cx="77" cy="111" r="6" fill="#141821"/>` +
        `<circle cx="75" cy="109" r="2.5" fill="#cfd8ff"/>` +
        mothWing(angle, 1, P.violet, true),
      18,
    )
  );
}

/** A mosquito on long legs with a needle and red eyes: the small, fast night enemy, 238×167. */
export function mosquito(frame: number, frames: number, id: string): string {
  const phase = phaseOf(frame, frames);
  const angle = -20 + Math.cos(phase) * 30;
  const legs = lines(
    [
      'M90,100 L70,128 L58,162',
      'M100,104 L102,136 L94,164',
      'M110,102 L132,128 L150,160',
      'M120,98 L150,116 L176,148',
    ],
    3,
    P.steel,
  );
  return (
    `<defs>` +
    `<clipPath id="${id}-abd"><ellipse cx="160" cy="100" rx="54" ry="15"/></clipPath>` +
    `<radialGradient id="${id}-eye"><stop offset="0.3" stop-color="${P.red}" stop-opacity="0.8"/><stop offset="1" stop-color="${P.red}" stop-opacity="0"/></radialGradient>` +
    `</defs>` +
    bobbing(
      phase,
      wing(106, 76, angle + 14, { scaleX: 0.65, scaleY: 0.5, fill: '#e6e8ff', opacity: 0.35 }) +
        legs +
        `<g transform="rotate(12,160,100)">` +
        `<ellipse cx="160" cy="100" rx="54" ry="15" fill="${P.shell}"/>` +
        `<g clip-path="url(#${id}-abd)">` +
        [124, 146, 168, 190]
          .map(
            (x) =>
              `<rect x="${String(x)}" y="80" width="8" height="40" fill="${P.silverShade}" opacity="0.85"/>`,
          )
          .join('') +
        `</g>` +
        `<ellipse cx="160" cy="100" rx="54" ry="15" fill="none" stroke="${INK}" stroke-width="3.5"/>` +
        `</g>` +
        `<ellipse cx="100" cy="86" rx="24" ry="19" fill="#4a5262" stroke="${INK}" stroke-width="4"/>` +
        `<path d="M86,76 C94,70 106,70 114,76" fill="none" stroke="${P.steel}" stroke-width="3" stroke-linecap="round"/>` +
        `<path d="M58,92 L6,108" stroke="${INK}" stroke-width="7" stroke-linecap="round"/>` +
        `<path d="M58,92 L8,107" stroke="#c9ced8" stroke-width="3" stroke-linecap="round"/>` +
        lines(['M66,78 C56,62 44,54 30,52', 'M70,76 C66,58 58,46 46,38'], 2.5, P.steel) +
        `<circle cx="66" cy="88" r="16" fill="${P.shell}" stroke="${INK}" stroke-width="4"/>` +
        `<circle cx="60" cy="86" r="14" fill="url(#${id}-eye)"/>` +
        `<circle cx="60" cy="86" r="7" fill="${P.red}" stroke="${INK}" stroke-width="2.5"/>` +
        `<circle cx="58" cy="84" r="2.5" fill="#ffffff"/>` +
        wing(102, 74, angle, { scaleX: 0.7, scaleY: 0.5, fill: '#eef0ff', opacity: 0.5 }),
    )
  );
}
