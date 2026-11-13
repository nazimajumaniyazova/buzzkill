import type { Renderer } from '@buzzkill/engine';
import { animationFrame, type GameRenderer, Kind, parallaxOffset, RULES } from '@buzzkill/game';
import { tokens } from '@buzzkill/ui';

import type { CityLayerName, GameSprites } from './sprites';

const { palette } = tokens.primitives;

/** The health bar's colors from the design tokens, resolved once here, never read in a frame. */
const COLORS = {
  healthTrack: palette.shade[60].value,
  health: palette.green[500].value,
} as const;

/**
 * How fast each layer of the city scrolls, as a share of `RULES.scrollSpeed`: the nearer, the
 * faster, and the sky stays still. The near layer keeps pace with the explosions, which drift at
 * the full speed.
 */
const PARALLAX: Readonly<Record<CityLayerName, number>> = {
  sky: 0,
  clouds: 0.1,
  far: 0.25,
  mid: 0.5,
  near: 1,
};

/** Under reduced motion, from the setting or the system (#114), the city scrolls this much slower. */
const REDUCED_PARALLAX = 0.25;

export interface GameDrawerOptions {
  /** Read every frame, so a change applies to the run on screen. Defaults to full motion. */
  readonly reducedMotion?: () => boolean;
}

/** The health bar of the 2023 game: 50 px wide, 10 px below the enemy's top edge. */
const HEALTH_BAR = { width: 50, height: 10, offsetY: 10 } as const;

/**
 * The shot in flight, `shot-trail` of the art: 30 x 6 in the world, with the head, which is the
 * 10 x 3 hitbox, at (20, 1.5). The tail fades out behind it.
 */
const SHOT_TRAIL = { size: { width: 30, height: 6 }, headX: 20, headY: 1.5 } as const;

/**
 * Draws a run with the engine's renderer: the game's side of the `GameRenderer` port. It reads the
 * world and never writes to it. The city of the run's time of day comes first, its layers
 * scrolling at their own pace (parallax). Positions are interpolated between the previous and the
 * current tick, so motion is smooth at any refresh rate; animation frames follow from the tick.
 */
export function createGameDrawer<TImage>(
  renderer: Renderer<TImage>,
  sprites: GameSprites<TImage>,
  options: GameDrawerOptions = {},
): GameRenderer {
  const explosionFrames = RULES.explosion.frames;
  const explosionFrameTicks = RULES.explosion.frameTicks;
  const reducedMotion = options.reducedMotion ?? (() => false);
  // The layers are drawn at the world's size; one object for every frame.
  const worldSize = { width: renderer.width, height: renderer.height };

  return {
    render(view, alpha) {
      const { world, tick } = view;
      renderer.beginFrame();

      const time = tick + alpha;
      const pace = reducedMotion() ? REDUCED_PARALLAX : 1;
      for (const { layer, atlas } of sprites.backgrounds[view.mode]) {
        const speed = PARALLAX[layer] * pace;
        if (speed === 0) {
          renderer.drawSprite(atlas, 0, 0, 0, worldSize);
          continue;
        }
        // Drawn twice, one width apart, so the layer tiles across the screen.
        const x = parallaxOffset(time, worldSize.width, speed);
        renderer.drawSprite(atlas, 0, x, 0, worldSize);
        renderer.drawSprite(atlas, 0, x + worldSize.width, 0, worldSize);
      }

      for (let index = 0; index < world.count; index += 1) {
        const id = world.at(index);
        // Typed-array reads are in bounds: `id` is a live entity of this world.
        const prevX = world.prevX[id] as number;
        const prevY = world.prevY[id] as number;
        const x = prevX + ((world.x[id] as number) - prevX) * alpha;
        const y = prevY + ((world.y[id] as number) - prevY) * alpha;
        const width = world.width[id] as number;
        const height = world.height[id] as number;
        const size = { width, height };

        switch (world.kind[id] as number) {
          case Kind.player: {
            const { atlas, frameTicks } = sprites.heroes[view.heroId];
            const frame = animationFrame(tick, 0, atlas.frames.length, frameTicks);
            renderer.drawSprite(atlas, frame, x, y, size);
            break;
          }
          case Kind.enemy: {
            const config = view.enemies[world.variant[id] as number];
            // Every configured enemy has its art (see sprites.ts), so nothing is skipped in play.
            const animation =
              config === undefined ? undefined : sprites.enemies[config.sprite.sheet];
            if (animation !== undefined) {
              const { atlas, frameTicks } = animation;
              const born = world.bornTick[id] as number;
              const frame = animationFrame(tick, born, atlas.frames.length, frameTicks);
              renderer.drawSprite(atlas, frame, x, y, size);
            }
            const health = (world.health[id] as number) / Math.max(1, world.value[id] as number);
            const barY = y + HEALTH_BAR.offsetY;
            renderer.fillRect(x, barY, HEALTH_BAR.width, HEALTH_BAR.height, COLORS.healthTrack);
            renderer.fillRect(x, barY, HEALTH_BAR.width * health, HEALTH_BAR.height, COLORS.health);
            break;
          }
          case Kind.projectile: {
            const { headX, headY } = SHOT_TRAIL;
            renderer.drawSprite(sprites.projectile, 0, x - headX, y - headY, SHOT_TRAIL.size);
            break;
          }
          case Kind.powerUp: {
            // Every kind has its art (see sprites.ts), so nothing is skipped in play.
            const animation = sprites.powerUps[world.variant[id] as number];
            if (animation !== undefined) {
              const { atlas, frameTicks } = animation;
              const born = world.bornTick[id] as number;
              const frame = animationFrame(tick, born, atlas.frames.length, frameTicks);
              renderer.drawSprite(atlas, frame, x, y, size);
            }
            break;
          }
          case Kind.explosion: {
            const atlas = sprites.explosions[world.variant[id] === 1 ? 1 : 0];
            const frame = animationFrame(
              tick,
              world.bornTick[id] as number,
              explosionFrames,
              explosionFrameTicks,
            );
            renderer.drawSprite(atlas, frame, x, y, size);
            break;
          }
          default:
          // No other kinds exist; an unknown one would draw nothing.
        }
      }
      renderer.endFrame();
    },
  };
}
