import { DAY_ENEMIES, HEROES, NIGHT_ENEMIES, RULES } from '@buzzkill/game';
import { describe, expect, it } from 'vitest';

import { ATLASES, BACKGROUNDS, SPRITES } from '../assets/manifest.gen';
import { GAME_ASSETS } from './assets';
import { createGameSprites } from './sprites';

const IMAGES = {
  creatures: 'creatures',
  effects: 'effects',
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
  it('loads both atlases of the generated manifest', () => {
    expect([GAME_ASSETS.creatures, GAME_ASSETS.effects]).toEqual([
      { kind: 'image', url: ATLASES.creatures.url },
      { kind: 'image', url: ATLASES.effects.url },
    ]);
  });

  it.each([GAME_ASSETS.shot, GAME_ASSETS.explosion, GAME_ASSETS.hit])(
    'keeps the sound $url optional, with a WAV fallback',
    (sound) => {
      expect(sound).toMatchObject({ kind: 'audio', optional: true });
      expect(sound.url).toMatch(/\.ogg$/);
      expect(sound.fallbackUrl).toMatch(/\.wav$/);
    },
  );

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

    expect(sprites.heroes.male.atlas.frames).toBe(SPRITES[HEROES.male.sprite.sheet].frames);
    expect(sprites.heroes.female.atlas.frames).toBe(SPRITES[HEROES.female.sprite.sheet].frames);
    expect(sprites.heroes.female.frameTicks).toBe(SPRITES.julie.frameTicks);
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
