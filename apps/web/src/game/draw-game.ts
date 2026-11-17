import type { Renderer, SpriteAtlas } from '@buzzkill/engine';
import {
  animationFrame,
  type GameRenderer,
  isBossEnraged,
  Kind,
  parallaxOffset,
  RULES,
} from '@buzzkill/game';
import { tokens } from '@buzzkill/ui';

import { createParticleEffects } from './particles';
import { createShakeEffects } from './screen-shake';
import { createSpriteEffects, FLASH, NO_SCALE, type SpriteScale } from './sprite-effects';
import type { CityLayerName, GameSprites } from './sprites';

const { palette } = tokens.primitives;

/** The health bar's colors from the design tokens, resolved once here, never read in a frame. */
const COLORS = {
  healthTrack: palette.shade[60].value,
  health: palette.green[500].value,
  chargeLane: palette.red[400].value,
} as const;

/**
 * While the queen winds up a charge (#152), red lines this thick run along the top and the bottom
 * of her path across the whole screen, and she shakes this many pixels to either side, turning
 * every two ticks. Under reduced motion she keeps still, and the lines alone give the warning.
 */
const CHARGE_WARNING = { line: 4, shake: 4, shakeTicks: 2 } as const;

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
  /** The particles setting (#156), read every frame and at every burst. Defaults to on. */
  readonly particles?: () => boolean;
  /** The screen shake setting (#157), read every frame and at every event. Defaults to on. */
  readonly screenShake?: () => boolean;
  /** The hit flash setting (#159), read every frame. Defaults to on. */
  readonly hitFlash?: () => boolean;
  /** The squash and stretch setting (#159), read every frame. Defaults to on. */
  readonly squashStretch?: () => boolean;
  /** Seeds the particles' and the shake's own randomness, never the simulation's. Defaults to 1. */
  readonly seed?: number;
}

/**
 * A shot sheds its trail for at most this many ticks in one frame, the most a frame moves the
 * particles: after a stall the trail goes on instead of piling up.
 */
const MAX_TRAIL_TICKS = 4;

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
 *
 * The particles (#156) follow the run's events through `listen`: dust and trails are drawn behind
 * the hero and the insects, sparks and debris in front of them. So does the screen shake (#157),
 * which moves the camera of the whole frame, and so do the flashes of hits (#159), which tint a
 * sprite white for a moment. The hero squashes when it fires and insects stretch as they bob, both
 * about the middle of their base.
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
  const effects = createParticleEffects({
    enabled: options.particles ?? (() => true),
    reducedMotion,
    seed: options.seed ?? 1,
  });
  const shake = createShakeEffects({
    enabled: options.screenShake ?? (() => true),
    reducedMotion,
    seed: options.seed ?? 1,
  });
  const spriteEffects = createSpriteEffects({
    hitFlash: options.hitFlash ?? (() => true),
    squashStretch: options.squashStretch ?? (() => true),
    reducedMotion,
  });
  let lastTick: number | undefined;

  /**
   * Draws a frame of `atlas` in the box at (`x`, `y`), scaled about the middle of the box's base,
   * and tinted white by `flash` when it is above 0.
   */
  const drawSprite = (
    atlas: SpriteAtlas<TImage>,
    frame: number,
    x: number,
    y: number,
    width: number,
    height: number,
    scale: SpriteScale,
    flash: number,
  ): void => {
    const scaledWidth = width * scale.x;
    const scaledHeight = height * scale.y;
    renderer.drawSprite(
      atlas,
      frame,
      x + (width - scaledWidth) / 2,
      y + (height - scaledHeight),
      flash > 0
        ? { width: scaledWidth, height: scaledHeight, tint: FLASH.color, tintAmount: flash }
        : { width: scaledWidth, height: scaledHeight },
    );
  };

  return {
    listen(events) {
      effects.listen(events);
      shake.listen(events);
      spriteEffects.listen(events);
    },
    render(view, alpha) {
      const { world, tick } = view;
      const time = tick + alpha;
      renderer.beginFrame(shake.advance(time));

      // Ticks simulated since the last frame: a shot sheds its trail once for each.
      const newTicks =
        lastTick === undefined ? 0 : Math.min(Math.max(tick - lastTick, 0), MAX_TRAIL_TICKS);
      lastTick = tick;
      effects.advance(time);
      spriteEffects.begin(view);
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
      effects.drawBack(renderer);

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
            drawSprite(
              atlas,
              frame,
              x,
              y,
              width,
              height,
              spriteEffects.heroScale(time),
              spriteEffects.flash(view, id, time),
            );
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
              const bob = (world.y[id] as number) - prevY;
              drawSprite(
                atlas,
                frame,
                x,
                y,
                width,
                height,
                spriteEffects.enemyScale(bob),
                spriteEffects.flash(view, id, time),
              );
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
            // From the back of the hitbox, so the specks fall behind the drawn tail.
            effects.trail(x, y + height * 0.5, newTicks);
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
          case Kind.boss: {
            const { queen, rage } = sprites.boss;
            const frame = animationFrame(
              tick,
              world.bornTick[id] as number,
              queen.atlas.frames.length,
              queen.frameTicks,
            );
            let shake = 0;
            if (view.boss.phase === 'windup') {
              const { line } = CHARGE_WARNING;
              renderer.fillRect(0, y, worldSize.width, line, COLORS.chargeLane);
              renderer.fillRect(0, y + height - line, worldSize.width, line, COLORS.chargeLane);
              if (!reducedMotion()) {
                const turn = Math.floor(tick / CHARGE_WARNING.shakeTicks) % 2;
                shake = turn === 0 ? -CHARGE_WARNING.shake : CHARGE_WARNING.shake;
              }
            }
            // Her rage is an overlay of the same frame, so it flashes with her.
            const flash = spriteEffects.flash(view, id, time);
            drawSprite(queen.atlas, frame, x + shake, y, width, height, NO_SCALE, flash);
            if (isBossEnraged(view.boss.phase)) {
              drawSprite(rage.atlas, frame, x + shake, y, width, height, NO_SCALE, flash);
            }
            break;
          }
          case Kind.sting: {
            renderer.drawSprite(sprites.boss.sting, 0, x, y, size);
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
      effects.drawFront(renderer);
      renderer.endFrame();
    },
  };
}
