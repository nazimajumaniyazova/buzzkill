/**
 * Seeded pseudo-random numbers for the simulation (ADR-0009). `Math.random` is banned in
 * `packages/game`: a replay must reproduce every roll, so all randomness flows from one generator
 * whose state is part of the world and can be saved, restored and hashed.
 *
 * The generator is sfc32 (Chris Doty-Humphrey's "Small Fast Counting" generator, 128-bit state,
 * period at least 2^32 per stream, passes PractRand), seeded through splitmix32 so that nearby
 * seeds give unrelated streams. Only 32-bit integer operations are used, which JavaScript defines
 * exactly, so every engine produces the same sequence.
 */

/** The four 32-bit words of a generator: everything needed to continue its sequence. */
export type RngState = readonly [a: number, b: number, c: number, d: number];

export interface Rng {
  /** Next integer in [0, 2^32). */
  nextUint32(): number;
  /** Next number in [0, 1) with 32 bits of resolution. */
  nextFloat(): number;
  /** Next integer in [min, max], both inclusive; the range may not exceed 2^32 values. */
  nextInt(min: number, max: number): number;
  /** True with the given probability, a number in [0, 1]. */
  chance(probability: number): boolean;
  /** A copy of the state. `setState` with it continues from exactly this point. */
  getState(): RngState;
  setState(state: RngState): void;
}

const UINT32_RANGE = 4_294_967_296;
/** Outputs discarded after seeding so that weak seeds do not show in the first values. */
const WARMUP_ROUNDS = 15;

function assertUint32(value: number, what: string): void {
  if (!Number.isInteger(value) || value < 0 || value >= UINT32_RANGE) {
    throw new RangeError(`${what} must be an integer in [0, 2^32), got ${String(value)}`);
  }
}

/** splitmix32: expands one 32-bit seed into a stream of well-mixed 32-bit words. */
function splitmix32(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x9e3779b9) | 0;
    let t = a ^ (a >>> 16);
    t = Math.imul(t, 0x21f0aaad);
    t = t ^ (t >>> 15);
    t = Math.imul(t, 0x735a2d97);
    t = t ^ (t >>> 15);
    return t >>> 0;
  };
}

/**
 * Creates a generator from a 32-bit seed. The same seed always yields the same sequence.
 *
 * @throws RangeError when the seed is not an integer in [0, 2^32).
 */
export function createRng(seed: number): Rng {
  assertUint32(seed, 'createRng: seed');

  // Internal words are kept as signed 32-bit integers, the form the `| 0` arithmetic produces.
  let a = 0;
  let b = 0;
  let c = 0;
  let d = 0;

  const nextUint32 = (): number => {
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) | 0;
    return t >>> 0;
  };

  const nextFloat = (): number => nextUint32() / UINT32_RANGE;

  const mix = splitmix32(seed);
  a = mix() | 0;
  b = mix() | 0;
  c = mix() | 0;
  d = mix() | 0;
  for (let i = 0; i < WARMUP_ROUNDS; i += 1) {
    nextUint32();
  }

  return {
    nextUint32,
    nextFloat,
    nextInt(min: number, max: number): number {
      if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max) || min > max) {
        throw new RangeError(
          `nextInt: need integers min <= max, got ${String(min)}, ${String(max)}`,
        );
      }
      const range = max - min + 1;
      if (range > UINT32_RANGE) {
        throw new RangeError(`nextInt: the range may not exceed 2^32 values, got ${String(range)}`);
      }
      // floor(u * range) with u in [0, 1) is always below range: u is at most 1 - 2^-32.
      return min + Math.floor(nextFloat() * range);
    },
    chance(probability: number): boolean {
      if (!(probability >= 0 && probability <= 1)) {
        throw new RangeError(`chance: probability must be in [0, 1], got ${String(probability)}`);
      }
      return nextFloat() < probability;
    },
    getState(): RngState {
      return [a >>> 0, b >>> 0, c >>> 0, d >>> 0];
    },
    setState(state: RngState): void {
      for (const word of state) {
        assertUint32(word, 'setState: every word');
      }
      [a, b, c, d] = [state[0] | 0, state[1] | 0, state[2] | 0, state[3] | 0];
    },
  };
}
