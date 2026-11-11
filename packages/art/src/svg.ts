/** The outline of every sprite. */
export const INK = '#1b1f2a';

/** A coordinate for SVG text, to one decimal place: short markup, the same on every run. */
export function n(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * A seeded random number generator (mulberry32), so a drawing with jitter comes out the same on
 * every run and every machine.
 */
export function random(seed: number): () => number {
  let state = seed | 0;
  return () => {
    state = (state + 0x6d_2b_79_f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

export interface BlobOptions {
  readonly points?: number;
  /** How far each point may stray from the radius, as a share of it. */
  readonly jitter?: number;
  readonly seed?: number;
}

/** A smooth closed blob around (cx, cy): a ring of jittered points joined by Catmull-Rom curves. */
export function blob(
  cx: number,
  cy: number,
  r: number,
  { points = 10, jitter = 0.3, seed = 1 }: BlobOptions = {},
): string {
  const next = random(seed);
  const ring: (readonly [number, number])[] = [];
  for (let i = 0; i < points; i += 1) {
    const angle = (i / points) * Math.PI * 2;
    const radius = r * (1 - jitter / 2 + next() * jitter);
    ring.push([cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius]);
  }
  const at = (i: number): readonly [number, number] =>
    ring[((i % points) + points) % points] as readonly [number, number];
  let d = `M${String(n(at(0)[0]))},${String(n(at(0)[1]))}`;
  for (let i = 0; i < points; i += 1) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${c1.map(n).join(',')} ${c2.map(n).join(',')} ${p2.map(n).join(',')}`;
  }
  return `${d}Z`;
}

/** A thick rounded stroke with an ink outline: a leg, an arm, a dragonfly's tail. */
export function limb(d: string, color: string, width: number): string {
  const stroke = (paint: string, w: number): string =>
    `<path d="${d}" fill="none" stroke="${paint}" stroke-width="${String(w)}" stroke-linecap="round" stroke-linejoin="round"/>`;
  return stroke(INK, width + 7) + stroke(color, width);
}

/** Thin ink lines for legs and feelers. */
export function lines(paths: readonly string[], width = 4.5, color = INK): string {
  return paths
    .map(
      (d) =>
        `<path d="${d}" fill="none" stroke="${color}" stroke-width="${String(width)}" stroke-linecap="round" stroke-linejoin="round"/>`,
    )
    .join('');
}
