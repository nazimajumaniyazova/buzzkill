import { n, random } from './svg';

export type TimeOfDay = 'day' | 'night';

/**
 * The layers of the city, back to front. `sky` stays still; the others scroll, slower the further
 * they are, and each tiles: what leaves the right edge comes back at the left.
 */
export const CITY_LAYERS = ['sky', 'clouds', 'far', 'mid', 'near'] as const;
export type CityLayer = (typeof CITY_LAYERS)[number];

/** The world's size: the backgrounds are drawn in world pixels and scale with the canvas. */
export const WORLD_SIZE = { width: 1280, height: 720 } as const;

const { width: W, height: H } = WORLD_SIZE;

interface SkylineStyle {
  readonly minH: number;
  readonly maxH: number;
  readonly minW: number;
  readonly maxW: number;
  readonly fill: string;
  readonly windows: string | null;
  readonly windowOpacity: number;
  readonly density: number;
}

/** A row of towers standing on the bottom edge: flat roofs, domes, spires and stepped tops. */
function skyline(seed: number, style: SkylineStyle): string {
  const next = random(seed);
  let shapes = '';
  const tower = (x: number, w: number, h: number): string => {
    const top = H - h;
    const kind = next();
    const rect = (rx: number, ry: number, rw: number, rh: number): string =>
      `<rect x="${String(n(rx))}" y="${String(n(ry))}" width="${String(n(rw))}" height="${String(n(rh))}" fill="${style.fill}"/>`;
    let s = rect(x, top, w, h + 4);
    if (kind < 0.2) {
      s += `<path d="M${String(n(x))},${String(n(top))} A${String(n(w / 2))},${String(n(w / 2.4))} 0 0 1 ${String(n(x + w))},${String(n(top))} Z" fill="${style.fill}"/>`;
    } else if (kind < 0.4) {
      s += `<path d="M${String(n(x + w * 0.2))},${String(n(top))} L${String(n(x + w / 2))},${String(n(top - w * 0.9))} L${String(n(x + w * 0.8))},${String(n(top))} Z" fill="${style.fill}"/>`;
      s += rect(x + w / 2 - 1.5, top - w * 0.9 - 26, 3, 28);
    } else if (kind < 0.55) {
      s += rect(x + w * 0.15, top - 22, w * 0.7, 24);
      s += rect(x + w * 0.3, top - 40, w * 0.4, 20);
    }
    if (style.windows !== null) {
      for (let wy = top + 14; wy < H - 12; wy += 18) {
        for (let wx = x + 8; wx < x + w - 10; wx += 14) {
          if (next() < style.density) {
            s += `<rect x="${String(n(wx))}" y="${String(n(wy))}" width="6" height="9" fill="${style.windows}" opacity="${String(style.windowOpacity)}"/>`;
          }
        }
      }
    }
    return s;
  };
  let x = -next() * 60;
  while (x < W) {
    const w = style.minW + next() * (style.maxW - style.minW);
    const h = style.minH + next() * (style.maxH - style.minH);
    const shape = tower(x, w, h);
    shapes += shape;
    if (x + w > W) {
      // The part past the right edge again at the left, so the layer tiles without a seam.
      shapes += `<g transform="translate(${String(-W)},0)">${shape}</g>`;
    }
    x += w + next() * 10;
  }
  return shapes;
}

/** A cartoon cloud: a few circles on a flat base, with a soft shadow underneath. */
function cloud(cx: number, cy: number, scale: number, next: () => number): string {
  const puffs = [
    [-60, 0, 30],
    [-26, -22, 40],
    [16, -30, 46],
    [56, -10, 34],
    [80, 4, 24],
  ] as const;
  const shape = puffs
    .map(
      ([x, y, r]) =>
        `<circle cx="${String(n(cx + x * scale))}" cy="${String(n(cy + y * scale))}" r="${String(n(r * scale * (0.9 + next() * 0.2)))}"/>`,
    )
    .join('');
  const base = `<rect x="${String(n(cx - 70 * scale))}" y="${String(n(cy - 4 * scale))}" width="${String(n(160 * scale))}" height="${String(n(30 * scale))}" rx="${String(n(15 * scale))}"/>`;
  return (
    `<g fill="#cfe2f5" transform="translate(0,${String(n(8 * scale))})" opacity="0.7">${shape}${base}</g>` +
    `<g fill="#ffffff">${shape}${base}</g>`
  );
}

function sky(time: TimeOfDay, id: string): string {
  const day = time === 'day';
  let out =
    `<defs><linearGradient id="${id}-sky" x1="0" y1="0" x2="0" y2="1">` +
    (day
      ? `<stop offset="0" stop-color="#6aa2ea"/><stop offset="0.7" stop-color="#bfe3ff"/><stop offset="1" stop-color="#e9f5ff"/>`
      : `<stop offset="0" stop-color="#0b0e14"/><stop offset="0.65" stop-color="#121a2b"/><stop offset="1" stop-color="#24365e"/>`) +
    `</linearGradient>` +
    (day
      ? ''
      : `<mask id="${id}-moon"><rect width="${String(W)}" height="${String(H)}" fill="#ffffff"/><circle cx="1070" cy="96" r="40" fill="#000000"/></mask>` +
        `<radialGradient id="${id}-halo"><stop offset="0.6" stop-color="#f5f7fa" stop-opacity="0.12"/><stop offset="1" stop-color="#f5f7fa" stop-opacity="0"/></radialGradient>`) +
    `</defs>` +
    `<rect width="${String(W)}" height="${String(H)}" fill="url(#${id}-sky)"/>`;
  if (day) {
    out += `<circle cx="1060" cy="120" r="70" fill="#fff6d6" opacity="0.5"/><circle cx="1060" cy="120" r="48" fill="#fff3c4"/>`;
  } else {
    const next = random(202);
    for (let i = 0; i < 140; i += 1) {
      out += `<circle cx="${String(n(next() * W))}" cy="${String(n(next() * 470))}" r="${String(n(0.8 + next() * 1.6))}" fill="#ffffff" opacity="${String(n(0.3 + next() * 0.6))}"/>`;
    }
    out +=
      `<circle cx="1050" cy="110" r="90" fill="url(#${id}-halo)"/>` +
      `<circle cx="1050" cy="110" r="44" fill="#f5f7fa" mask="url(#${id}-moon)"/>`;
  }
  return out;
}

const TOWERS: Readonly<Record<TimeOfDay, Readonly<Record<'far' | 'mid' | 'near', SkylineStyle>>>> =
  {
    day: {
      far: {
        minH: 170,
        maxH: 280,
        minW: 50,
        maxW: 110,
        fill: '#b8d3ee',
        windows: null,
        windowOpacity: 0,
        density: 0,
      },
      mid: {
        minH: 110,
        maxH: 200,
        minW: 60,
        maxW: 130,
        fill: '#86a8cf',
        windows: '#c7dcf2',
        windowOpacity: 0.7,
        density: 0.35,
      },
      near: {
        minH: 60,
        maxH: 130,
        minW: 70,
        maxW: 150,
        fill: '#557196',
        windows: '#9cbbe0',
        windowOpacity: 0.8,
        density: 0.35,
      },
    },
    night: {
      far: {
        minH: 170,
        maxH: 280,
        minW: 50,
        maxW: 110,
        fill: '#1a2438',
        windows: '#f5c242',
        windowOpacity: 0.3,
        density: 0.1,
      },
      mid: {
        minH: 110,
        maxH: 200,
        minW: 60,
        maxW: 130,
        fill: '#131b2b',
        windows: '#f5c242',
        windowOpacity: 0.6,
        density: 0.18,
      },
      near: {
        minH: 60,
        maxH: 130,
        minW: 70,
        maxW: 150,
        fill: '#0b1019',
        windows: '#f5c242',
        windowOpacity: 0.9,
        density: 0.22,
      },
    },
  };

const SEEDS = { far: 11, mid: 23, near: 37 } as const;

/** The markup of one layer of the city, in world pixels. */
export function cityLayer(time: TimeOfDay, layer: CityLayer, id: string): string {
  switch (layer) {
    case 'sky':
      return sky(time, id);
    case 'clouds': {
      if (time === 'night') {
        return '';
      }
      const next = random(101);
      let out = '';
      for (let i = 0; i < 5; i += 1) {
        out += cloud(110 + i * 240 + next() * 60, 80 + next() * 170, 0.7 + next() * 0.6, next);
      }
      return out;
    }
    case 'far':
    case 'mid':
      return skyline(SEEDS[layer] + (time === 'day' ? 0 : 100), TOWERS[time][layer]);
    case 'near': {
      const rail = time === 'day' ? '#3d5677' : '#06090f';
      let out = skyline(SEEDS.near + (time === 'day' ? 0 : 100), TOWERS[time].near);
      // A monorail across the front.
      out += `<rect x="0" y="646" width="${String(W)}" height="9" fill="${rail}"/>`;
      for (let x = 40; x < W; x += 160) {
        out += `<rect x="${String(x)}" y="655" width="9" height="65" fill="${rail}"/>`;
      }
      return out;
    }
  }
}
