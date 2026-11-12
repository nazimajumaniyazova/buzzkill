import type { Renderer } from '@buzzkill/engine';
import { animationFrame, type GameRenderer, Kind, RULES } from '@buzzkill/game';
import { tokens } from '@buzzkill/ui';

import type { GameSprites } from './sprites';

const { palette } = tokens.primitives;
const { color } = tokens.semantic;

/**
 * Colors from the design tokens: the sky is each theme's canvas, the health bar uses palette
 * entries. Resolved once here, never read from the DOM in a frame.
 */
const COLORS = {
  sky: { day: color.day.canvas.value, night: color.night.canvas.value },
  healthTrack: palette.shade[60].value,
  health: palette.green[500].value,
} as const;

/** The health bar of the 2023 game: 50 px wide, 10 px below the enemy's top edge. */
const HEALTH_BAR = { width: 50, height: 10, offsetY: 10 } as const;

/**
 * The shot in flight, `shot-trail` of the art: 30 x 6 in the world, with the head, which is the
 * 10 x 3 hitbox, at (20, 1.5). The tail fades out behind it.
 */
const SHOT_TRAIL = { size: { width: 30, height: 6 }, headX: 20, headY: 1.5 } as const;

/**
 * Draws a run with the engine's renderer: the game's side of the `GameRenderer` port. It reads the
 * world and never writes to it. Positions are interpolated between the previous and the current
 * tick, so motion is smooth at any refresh rate; animation frames follow from the tick.
 */
export function createGameDrawer<TImage>(
  renderer: Renderer<TImage>,
  sprites: GameSprites<TImage>,
): GameRenderer {
  const explosionFrames = RULES.explosion.frames;
  const explosionFrameTicks = RULES.explosion.frameTicks;

  return {
    render(view, alpha) {
      const { world, tick } = view;
      renderer.beginFrame();
      renderer.fillRect(0, 0, renderer.width, renderer.height, COLORS.sky[view.mode]);

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
