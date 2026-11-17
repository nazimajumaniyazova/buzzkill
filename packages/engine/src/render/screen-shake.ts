import type { Rng } from '../math/rng';

/**
 * Screen shake by trauma (#157), after Squirrel Eiserloh's "Juicing Your Cameras With Math" (GDC
 * 2016). Events add trauma, from 0 to 1, and it drains away at a steady pace. The shake is the
 * square of the trauma, so a hard knock jolts and then settles smoothly, and small knocks barely
 * show. Each frame the camera moves by smooth noise scaled by the shake: an offset and a rotation.
 *
 * Drawing only: the noise has its own RNG, never the simulation's. The engine is unit-agnostic:
 * `decay` is trauma per unit of time and `frequency` noise knots per unit of time; the game uses
 * ticks.
 */

/**
 * Where the renderer looks from: an offset in logical pixels, a rotation in radians and a zoom,
 * the last two about the center of the play area.
 */
export interface Camera {
  readonly x: number;
  readonly y: number;
  readonly angle: number;
  readonly zoom: number;
}

/** The camera that leaves the scene as it is. */
export const IDENTITY_CAMERA: Camera = Object.freeze({ x: 0, y: 0, angle: 0, zoom: 1 });

export interface ScreenShakeOptions {
  /** The noise's own randomness; never the simulation's RNG. */
  readonly rng: Rng;
  /** The offset at full trauma, in logical pixels, either way on each axis. */
  readonly maxOffset: number;
  /** The rotation at full trauma, in radians, either way. */
  readonly maxAngle: number;
  /** Trauma lost per unit of time. */
  readonly decay: number;
  /** Noise knots per unit of time: how fast the camera trembles. */
  readonly frequency: number;
  /** The play area, which the shaken scene must keep covering. */
  readonly width: number;
  readonly height: number;
}

export interface ScreenShake {
  /** From 0, still, to 1. */
  readonly trauma: number;
  /** Adds trauma, up to 1. Nothing for an amount that is not above 0. */
  add(amount: number): void;
  /** Drains `decay × dt` trauma, down to 0. Nothing for a `dt` that is not above 0. */
  update(dt: number): void;
  /** Drops all trauma at once. */
  clear(): void;
  /**
   * The camera at `time`: the offset and the rotation from the shake and the noise, and the zoom
   * that keeps the play area covered. The same object every call, rewritten.
   */
  camera(time: number): Camera;
}

/** Knots per noise channel; a power of two, so an index wraps with a mask. */
const KNOTS = 256;

/**
 * The zoom about the center that keeps the play area covered by a scene moved by (`x`, `y`) and
 * turned by `angle`: each corner of the area, taken back through the camera, must land inside the
 * scene. 1 for a still camera; never below 1.
 */
export function coverZoom(
  width: number,
  height: number,
  x: number,
  y: number,
  angle: number,
): number {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  let zoom = 1;
  for (let corner = 0; corner < 4; corner += 1) {
    const dx = (corner & 1 ? halfWidth : -halfWidth) - x;
    const dy = (corner & 2 ? halfHeight : -halfHeight) - y;
    const across = Math.abs(cos * dx + sin * dy) / halfWidth;
    const down = Math.abs(-sin * dx + cos * dy) / halfHeight;
    zoom = Math.max(zoom, across, down);
  }
  return zoom;
}

/**
 * Creates a screen shake, still until trauma is added.
 *
 * @throws RangeError for a negative or non-finite reach or rotation, a decay or a frequency that is
 *   not above 0, or a play area of no size.
 */
export function createScreenShake(options: ScreenShakeOptions): ScreenShake {
  const { rng, maxOffset, maxAngle, decay, frequency, width, height } = options;
  const problems = [
    !(Number.isFinite(maxOffset) && maxOffset >= 0) && 'maxOffset must be at least 0',
    !(Number.isFinite(maxAngle) && maxAngle >= 0) && 'maxAngle must be at least 0',
    !(Number.isFinite(decay) && decay > 0) && 'decay must be above 0',
    !(Number.isFinite(frequency) && frequency > 0) && 'frequency must be above 0',
    !(width > 0 && height > 0) && 'the play area must have a size',
  ].filter((problem) => problem !== false);
  if (problems.length > 0) {
    throw new RangeError(`createScreenShake: ${problems.join('; ')}`);
  }

  // Three channels of value noise, one each for x, y and the angle, in [-1, 1].
  const knots = new Float64Array(KNOTS * 3);
  for (let index = 0; index < knots.length; index += 1) {
    knots[index] = rng.nextFloat() * 2 - 1;
  }

  /** Smooth noise in [-1, 1]: the knots joined by smoothstep, so it has no corners. */
  const noise = (channel: number, time: number): number => {
    const position = time * frequency;
    const whole = Math.floor(position);
    const part = position - whole;
    const eased = part * part * (3 - 2 * part);
    const base = channel * KNOTS;
    // The masks keep both indices inside the channel, for any time, negative ones too.
    const from = knots[base + (whole & (KNOTS - 1))] as number;
    const to = knots[base + ((whole + 1) & (KNOTS - 1))] as number;
    return from + (to - from) * eased;
  };

  let trauma = 0;
  const camera = { x: 0, y: 0, angle: 0, zoom: 1 };

  return {
    get trauma() {
      return trauma;
    },
    add(amount) {
      if (amount > 0) {
        trauma = Math.min(1, trauma + amount);
      }
    },
    update(dt) {
      if (dt > 0) {
        trauma = Math.max(0, trauma - decay * dt);
      }
    },
    clear() {
      trauma = 0;
    },
    camera(time) {
      if (trauma === 0) {
        camera.x = 0;
        camera.y = 0;
        camera.angle = 0;
        camera.zoom = 1;
        return camera;
      }
      const shake = trauma * trauma;
      camera.x = maxOffset * shake * noise(0, time);
      camera.y = maxOffset * shake * noise(1, time);
      camera.angle = maxAngle * shake * noise(2, time);
      camera.zoom = coverZoom(width, height, camera.x, camera.y, camera.angle);
      return camera;
    },
  };
}
