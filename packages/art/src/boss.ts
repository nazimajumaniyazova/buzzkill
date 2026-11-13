import { PALETTE as P } from './palette';
import { INK, lines, n } from './svg';

/** One wing, pointing back from its root at (0, 0); the queen's are the wasp's, larger. */
const WING = 'M0,0 C18,-20 66,-34 100,-26 C114,-22 112,-6 98,-1 C70,8 26,9 0,0 Z';
const WING_VEINS = 'M8,-2 C34,-14 64,-20 96,-18 M12,1 C42,-2 72,-6 98,-8';

/** Where the front wing grows from and how large it is; the rage overlay masks it out. */
const FRONT_WING = { x: 232, y: 128, scale: 1.9 } as const;

const wingTransform = (x: number, y: number, angle: number, scale: number): string =>
  `translate(${String(x)},${String(y)}) rotate(${String(n(angle))}) scale(${String(scale)})`;

function wing(x: number, y: number, angle: number, scale: number, opacity: number): string {
  return (
    `<g transform="${wingTransform(x, y, angle, scale)}">` +
    `<path d="${WING}" fill="#f1edff" fill-opacity="${String(opacity)}" stroke="${INK}" stroke-opacity="0.6" stroke-width="2" stroke-linejoin="round"/>` +
    `<path d="${WING_VEINS}" fill="none" stroke="${INK}" stroke-opacity="0.25" stroke-width="1.2"/>` +
    `<path d="M14,-6 C38,-18 66,-24 90,-22" fill="none" stroke="#ffffff" stroke-opacity="0.7" stroke-width="2" stroke-linecap="round"/>` +
    `</g>`
  );
}

/**
 * The abdomen, bent down under the body so that its sting points ahead at the hero, as a wasp's
 * does when it stings.
 */
const ABDOMEN =
  'M284,150 C352,128 428,180 430,258 C432,334 372,374 306,370 C276,368 250,358 232,344 ' +
  'C262,334 288,318 298,294 C308,266 304,226 286,200 Z';

/** The stripes run across the bend: rays from a point inside its curve, so they never meet. */
const STRIPE_ANGLES = [-30, 4, 38, 72] as const;
const BEND = { x: 250, y: 262 } as const;

/** The crown on the queen's head: three points, the middle one tallest. */
const CROWN = 'M104,130 L108,88 L125,106 L140,70 L155,106 L172,88 L176,130 Q140,118 104,130 Z';

/** Her pose in a frame: one beat of the wings, the hind pair a little behind, and a bob. */
function pose(frame: number, frames: number) {
  const phase = (frame / frames) * Math.PI * 2;
  return {
    front: -6 + Math.cos(phase) * 18,
    hind: 2 + Math.cos(phase + 0.9) * 18,
    bob: 14 + Math.sin(phase) * 4,
  };
}

function stripes(color: string): string {
  return STRIPE_ANGLES.map((angle) => {
    const a = (angle * Math.PI) / 180;
    const x = BEND.x + Math.cos(a) * 220;
    const y = BEND.y + Math.sin(a) * 220;
    return `<path d="M${String(BEND.x)},${String(BEND.y)} L${String(n(x))},${String(n(y))}" stroke="${color}" stroke-width="22"/>`;
  }).join('');
}

/** The great eye and the tips of the feelers, cyan when calm and red in a rage. */
function eyes(color: string): string {
  return (
    `<circle cx="44" cy="96" r="7" fill="${color}" stroke="${INK}" stroke-width="2.5"/>` +
    `<circle cx="66" cy="72" r="7" fill="${color}" stroke="${INK}" stroke-width="2.5"/>` +
    `<ellipse cx="114" cy="160" rx="23" ry="30" fill="${color}" stroke="${INK}" stroke-width="4"/>` +
    `<ellipse cx="107" cy="148" rx="6" ry="9" fill="#ffffff" opacity="0.85"/>`
  );
}

/** The queen is drawn on a 480×400 grid, scaled by 1.25 to her frame and bobbing in it. */
const placed = (bob: number, inner: string): string =>
  `<g transform="scale(1.25) translate(0,${String(n(bob))})">${inner}</g>`;

/**
 * The boss of #152: a queen wasp in a crown, 600×500, twice her 300×250 box in the world. She
 * faces the hero like every enemy; violet stripes and a violet thorax set her apart from the amber
 * and black wasp.
 */
export function queen(frame: number, frames: number, id: string): string {
  const { front, hind, bob } = pose(frame, frames);
  const body =
    wing(238, 132, hind, 1.7, 0.4) +
    `<g opacity="0.8">${lines(['M216,214 l-6,32 l12,26', 'M244,212 l14,30 l20,16'], 5)}</g>` +
    // The abdomen with its shade, stripes and shine, then the sting.
    `<path d="M240,340 L196,362 L248,352 Z" fill="${INK}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>` +
    `<path d="${ABDOMEN}" fill="${P.amber}"/>` +
    `<g clip-path="url(#${id}-abd)">` +
    `<path d="${ABDOMEN}" transform="translate(12,16)" fill="${P.amberDark}" opacity="0.6"/>` +
    stripes(P.violet) +
    `<path d="M302,150 C356,142 414,186 418,240" fill="none" stroke="#ffffff" stroke-width="9" stroke-linecap="round" opacity="0.45"/>` +
    `</g>` +
    `<path d="${ABDOMEN}" fill="none" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>` +
    // The thorax.
    `<ellipse cx="232" cy="172" rx="60" ry="50" fill="${P.violetBody}"/>` +
    `<g clip-path="url(#${id}-thx)"><ellipse cx="244" cy="190" rx="60" ry="44" fill="${INK}" opacity="0.35"/></g>` +
    `<path d="M206,150 l14,18 l14,-18 M232,150 l14,18 l14,-18" fill="none" stroke="${P.amber}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<ellipse cx="220" cy="140" rx="26" ry="9" fill="${P.violetRim}" opacity="0.5"/>` +
    `<ellipse cx="232" cy="172" rx="60" ry="50" fill="none" stroke="${INK}" stroke-width="5"/>` +
    // The head: feelers, the head itself, the great eye, jaws and the crown.
    lines(['M98,134 C84,110 66,98 44,96', 'M108,126 C102,100 88,82 66,72'], 4.5) +
    `<circle cx="132" cy="168" r="48" fill="${P.amber}"/>` +
    `<g clip-path="url(#${id}-head)"><circle cx="150" cy="190" r="52" fill="${P.amberDark}" opacity="0.6"/></g>` +
    `<circle cx="132" cy="168" r="48" fill="none" stroke="${INK}" stroke-width="5"/>` +
    eyes(P.cyan) +
    lines(['M96,198 q-18,6 -14,22', 'M106,206 q-10,12 -2,24'], 6) +
    `<path d="${CROWN}" fill="${P.amber}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>` +
    `<path d="M112,120 Q140,112 168,120" fill="none" stroke="${P.amberDark}" stroke-width="5" stroke-linecap="round"/>` +
    `<circle cx="140" cy="104" r="7" fill="${P.red}" stroke="${INK}" stroke-width="2.5"/>` +
    `<circle cx="108" cy="88" r="4.5" fill="${P.cream}" stroke="${INK}" stroke-width="2"/>` +
    `<circle cx="140" cy="70" r="4.5" fill="${P.cream}" stroke="${INK}" stroke-width="2"/>` +
    `<circle cx="172" cy="88" r="4.5" fill="${P.cream}" stroke="${INK}" stroke-width="2"/>` +
    lines(['M188,212 l-16,28 l6,30', 'M230,220 l-2,34 l14,26'], 5) +
    wing(FRONT_WING.x, FRONT_WING.y, front, FRONT_WING.scale, 0.55);
  return (
    `<defs>` +
    `<clipPath id="${id}-abd"><path d="${ABDOMEN}"/></clipPath>` +
    `<clipPath id="${id}-thx"><ellipse cx="232" cy="172" rx="60" ry="50"/></clipPath>` +
    `<clipPath id="${id}-head"><circle cx="132" cy="168" r="48"/></clipPath>` +
    `</defs>` +
    placed(bob, body)
  );
}

/**
 * The queen's rage, drawn over her frame of the same number once she is under a third of her
 * health: red stripes, red eyes and a frown. Only what changes is drawn, so the rage costs a
 * fraction of a second set of frames. The stripes stop at her thorax and her front wing, which lie
 * over the abdomen.
 */
export function queenRage(frame: number, frames: number, id: string): string {
  const { front, bob } = pose(frame, frames);
  return (
    `<defs>` +
    `<clipPath id="${id}-abd"><path d="${ABDOMEN}"/></clipPath>` +
    `<mask id="${id}-wing" maskUnits="userSpaceOnUse" x="0" y="0" width="480" height="400">` +
    `<rect width="480" height="400" fill="#ffffff"/>` +
    `<path d="${WING}" transform="${wingTransform(FRONT_WING.x, FRONT_WING.y, front, FRONT_WING.scale)}" fill="#000000"/>` +
    `<ellipse cx="232" cy="172" rx="60" ry="50" fill="#000000"/>` +
    `</mask>` +
    `</defs>` +
    placed(
      bob,
      `<g mask="url(#${id}-wing)">` +
        `<g clip-path="url(#${id}-abd)">${stripes(P.red)}</g>` +
        `<path d="${ABDOMEN}" fill="none" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>` +
        `</g>` +
        eyes(P.red) +
        lines(['M92,130 L138,144'], 8),
    )
  );
}

/** The queen's sting, flying at the hero: 64×24, twice its 32×12 box. */
export function sting(): string {
  return (
    `<path d="M42,12 L62,12" stroke="${P.pinkLight}" stroke-width="5" stroke-linecap="round" opacity="0.75"/>` +
    `<path d="M2,12 L24,5 L50,8 L50,16 L24,19 Z" fill="${P.pink}" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>` +
    `<path d="M24,8 L46,10" stroke="${P.pinkLight}" stroke-width="2.5" stroke-linecap="round"/>` +
    `<path d="M2,12 L16,8 L16,16 Z" fill="${P.cream}" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>`
  );
}
