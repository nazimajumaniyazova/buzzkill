/**
 * Deterministic sine and cosine for the simulation (ADR-0009). `Math.sin` and `Math.cos` are
 * banned in `packages/game` because their last bits differ between JavaScript engines, which would
 * make a replay diverge between a player's browser and the verifying server.
 *
 * These versions use only addition, subtraction, multiplication, division and `Math.floor`, all of
 * which the language defines exactly (IEEE 754, round to nearest, no fused operations). The same
 * input therefore gives the same output everywhere. ADR-0009 names a lookup table as the
 * mechanism; a polynomial has the same property with less code and no interpolation error.
 *
 * Accuracy: the argument is reduced to [-π/4, π/4] (sine or cosine of the remainder, whichever
 * applies) and a Taylor series is summed up to the 13th power, which leaves an error around 1e-12
 * for |x| up to about 1e4. The reduction loses digits beyond that, as every float routine does.
 */

const TWO_PI = 2 * Math.PI;
const HALF_PI = Math.PI / 2;
const QUARTER_PI = Math.PI / 4;

/** sin(r) for |r| <= π/4: r - r^3/3! + r^5/5! - ... + r^13/13!, in Horner form. */
function sinSeries(r: number): number {
  const r2 = r * r;
  return (
    r *
    (1 +
      r2 *
        (-1 / 6 +
          r2 *
            (1 / 120 +
              r2 *
                (-1 / 5040 +
                  r2 * (1 / 362_880 + r2 * (-1 / 39_916_800 + r2 * (1 / 6_227_020_800)))))))
  );
}

/** cos(r) for |r| <= π/4: 1 - r^2/2! + r^4/4! - ... + r^12/12!, in Horner form. Exactly 1 at 0. */
function cosSeries(r: number): number {
  const r2 = r * r;
  return (
    1 +
    r2 *
      (-1 / 2 +
        r2 *
          (1 / 24 +
            r2 * (-1 / 720 + r2 * (1 / 40_320 + r2 * (-1 / 3_628_800 + r2 * (1 / 479_001_600))))))
  );
}

/** Sine of `x` radians. Returns NaN for a non-finite input, like `Math.sin`. */
export function sin(x: number): number {
  if (!Number.isFinite(x)) {
    return Number.NaN;
  }
  // Reduce to [-π, π), then fold onto [-π/2, π/2] using sin(π - r) = sin(r).
  let r = x - TWO_PI * Math.floor((x + Math.PI) / TWO_PI);
  if (r > HALF_PI) {
    r = Math.PI - r;
  } else if (r < -HALF_PI) {
    r = -Math.PI - r;
  }
  // Near ±π/2 the sine series converges slowly; use the cosine of the distance to ±π/2 instead.
  if (r > QUARTER_PI) {
    return cosSeries(HALF_PI - r);
  }
  if (r < -QUARTER_PI) {
    return -cosSeries(HALF_PI + r);
  }
  return sinSeries(r);
}

/** Cosine of `x` radians. Returns NaN for a non-finite input, like `Math.cos`. */
export function cos(x: number): number {
  return sin(x + HALF_PI);
}
