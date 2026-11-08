import type { Renderer } from '@buzzkill/engine';
import { animationFrame, type GameRenderer, Kind, RULES } from '@buzzkill/game';
import { tokens } from '@buzzkill/ui';

import type { GameSprites } from './sprites';

const { palette } = tokens.primitives;
const { color } = tokens.semantic;

/**
 * Stand-in colors for art that does not exist yet, the same values as the 2023 placeholders,
 * taken from the design tokens: the sky is each theme's canvas, the rest are palette entries.
 * Resolved once here, never read from the DOM in a frame.
 */
const COLORS = {
  sky: { day: color.day.canvas.value, night: color.night.canvas.value },
  hero: { male: palette.blue[500].value, female: palette.pink[400].value },
  enemy: palette.red[600].value,
  healthTrack: palette.shade[60].value,
  health: palette.green[500].value,
} as const;

/** The health bar of the 2023 game: 50 px wide, 10 px below the enemy's top edge. */
const HEALTH_BAR = { width: 50, height: 10, offsetY: 10 } as const;

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
            renderer.fillRect(x, y, width, height, COLORS.hero[view.heroId]);
            break;
          }
          case Kind.enemy: {
            const config = view.enemies[world.variant[id] as number];
            const atlas = config === undefined ? undefined : sprites.enemies[config.sprite.sheet];
            if (config !== undefined && atlas !== undefined) {
              const { frames, frameTicks } = config.sprite;
              const frame = animationFrame(tick, world.bornTick[id] as number, frames, frameTicks);
              renderer.drawSprite(atlas, frame, x, y, size);
            } else {
              renderer.fillRect(x, y, width, height, COLORS.enemy);
            }
            const health = (world.health[id] as number) / Math.max(1, world.value[id] as number);
            const barY = y + HEALTH_BAR.offsetY;
            renderer.fillRect(x, barY, HEALTH_BAR.width, HEALTH_BAR.height, COLORS.healthTrack);
            renderer.fillRect(x, barY, HEALTH_BAR.width * health, HEALTH_BAR.height, COLORS.health);
            break;
          }
          case Kind.projectile: {
            renderer.drawSprite(sprites.projectile, 0, x, y, size);
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
