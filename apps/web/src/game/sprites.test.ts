import {
  DAY_ENEMIES,
  HEROES,
  type HeroId,
  NIGHT_ENEMIES,
  POWER_UPS,
  QUEEN,
  RULES,
} from '@buzzkill/game';
import { describe, expect, it } from 'vitest';

import { ATLASES, BACKGROUNDS, SPRITES } from '../assets/manifest.gen';
import { GAME_ASSETS } from './assets';
import { createGameSprites } from './sprites';

const IMAGES = {
  creatures: 'creatures',
  effects: 'effects',
  boss: 'boss',
  'city-day-sky': 'city-day-sky',
  'city-day-clouds': 'city-day-clouds',
  'city-day-far': 'city-day-far',
  'city-day-mid': 'city-day-mid',
  'city-day-near': 'city-day-near',
  'city-night-sky': 'city-night-sky',
  'city-night-far': 'city-night-far',
  'city-night-mid': 'city-night-mid',
  'city-night-near': 'city-night-near',
};

describe('game assets and sprites', () => {
  it('loads the atlases of the generated manifest', () => {
    expect([GAME_ASSETS.creatures, GAME_ASSETS.effects, GAME_ASSETS.boss]).toEqual([
      { kind: 'image', url: ATLASES.creatures.url },
      { kind: 'image', url: ATLASES.effects.url },
      { kind: 'image', url: ATLASES.boss.url },
    ]);
  });

  it.each([
    GAME_ASSETS.shot,
    GAME_ASSETS.explosion,
    GAME_ASSETS.hit,
    GAME_ASSETS.pickup,
    GAME_ASSETS.bossPhase,
  ])('keeps the sound $url optional, with a WAV fallback', (sound) => {
    expect(sound).toMatchObject({ kind: 'audio', optional: true });
    expect(sound.url).toMatch(/\.ogg$/);
    expect(sound.fallbackUrl).toMatch(/\.wav$/);
  });

  it('animates every enemy of the configuration with the frames and pace of its art', () => {
    const sprites = createGameSprites(IMAGES);

    for (const { sprite } of [...DAY_ENEMIES, ...NIGHT_ENEMIES]) {
      const art = SPRITES[sprite.sheet];
      expect(sprites.enemies[sprite.sheet]).toEqual({
        atlas: { image: art.atlas, frames: art.frames },
        frameTicks: art.frameTicks,
      });
      // The frame keeps the configured size, so the hitbox, half of it, does not change.
      expect(art.frames[0]).toMatchObject({
        width: sprite.frameWidth,
        height: sprite.frameHeight,
      });
    }
  });

  it('animates each hero with its art', () => {
    const sprites = createGameSprites(IMAGES);

    expect(Object.keys(sprites.heroes)).toEqual(Object.keys(HEROES));
    for (const [heroId, { sprite }] of Object.entries(HEROES)) {
      const art = SPRITES[sprite.sheet];
      // The keys of `HEROES` are the hero ids.
      expect(sprites.heroes[heroId as HeroId]).toEqual({
        atlas: { image: IMAGES[art.atlas], frames: art.frames },
        frameTicks: art.frameTicks,
      });
    }
  });

  it('draws explosions in the frames and pace the simulation times them by', () => {
    const sprites = createGameSprites(IMAGES);

    expect(sprites.explosions.map((atlas) => [atlas.image, atlas.frames.length])).toEqual([
      ['effects', RULES.explosion.frames],
      ['effects', RULES.explosion.frames],
    ]);
    expect(SPRITES['explosion-smoke'].frameTicks).toBe(RULES.explosion.frameTicks);
    expect(SPRITES['explosion-fire'].frameTicks).toBe(RULES.explosion.frameTicks);
    expect(sprites.projectile).toEqual({ image: 'effects', frames: SPRITES['shot-trail'].frames });
  });

  it('animates each power-up with its art, in the order of the simulation, from the effects atlas', () => {
    const sprites = createGameSprites(IMAGES);

    expect(sprites.powerUps).toEqual(
      POWER_UPS.map(({ sprite }) => ({
        atlas: { image: 'effects', frames: SPRITES[sprite.sheet].frames },
        frameTicks: SPRITES[sprite.sheet].frameTicks,
      })),
    );
    expect(sprites.powerUps.map(({ atlas }) => atlas.frames.length)).toEqual([4, 4, 4, 4]);
  });

  it('animates the queen and her rage alike from the boss atlas, and cuts her sting from it', () => {
    const sprites = createGameSprites(IMAGES);
    const { sheet, rage, sting } = QUEEN.sprite;

    expect(sprites.boss).toEqual({
      queen: {
        atlas: { image: 'boss', frames: SPRITES[sheet].frames },
        frameTicks: SPRITES[sheet].frameTicks,
      },
      rage: {
        atlas: { image: 'boss', frames: SPRITES[rage].frames },
        frameTicks: SPRITES[rage].frameTicks,
      },
      sting: { image: 'boss', frames: SPRITES[sting].frames },
    });
    // The rage lies over her frame of the same number, so it has her frames and pace.
    expect(sprites.boss.rage.atlas.frames).toHaveLength(sprites.boss.queen.atlas.frames.length);
    expect(sprites.boss.rage.frameTicks).toBe(sprites.boss.queen.frameTicks);
  });

  it('loads every layer of the city and lays each time of day out back to front', () => {
    const sprites = createGameSprites(IMAGES);

    for (const time of ['day', 'night'] as const) {
      const layers = BACKGROUNDS[time];
      for (const { id, url } of layers) {
        expect(GAME_ASSETS[id]).toEqual({ kind: 'image', url });
      }
      expect(sprites.backgrounds[time]).toEqual(
        layers.map(({ id, layer }) => ({
          layer,
          atlas: { image: id, frames: [{ x: 0, y: 0, width: 1280, height: 720 }] },
        })),
      );
    }
    expect(sprites.backgrounds.day.map(({ layer }) => layer)).toEqual([
      'sky',
      'clouds',
      'far',
      'mid',
      'near',
    ]);
  });
});
