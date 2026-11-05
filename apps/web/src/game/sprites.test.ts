import { DAY_ENEMIES, NIGHT_ENEMIES, RULES } from '@buzzkill/game';
import { describe, expect, it } from 'vitest';

import { GAME_ASSETS, MISSING_SHEETS } from './assets';
import { createGameSprites } from './sprites';

const IMAGES = {
  'enemy-2': 'enemy-2',
  'enemy-3': 'enemy-3',
  enemy_bat_2: 'enemy_bat_2',
  enemy_bat_3: 'enemy_bat_3',
  enemy_raven: 'enemy_raven',
  projectile: 'projectile',
  smokeExplosion: 'smoke',
  fireExplosion: 'fire',
};

describe('game assets and sprites', () => {
  it('loads a sheet for every enemy kind, except the known placeholders', () => {
    for (const { sprite } of [...DAY_ENEMIES, ...NIGHT_ENEMIES]) {
      expect(sprite.sheet in GAME_ASSETS || MISSING_SHEETS.includes(sprite.sheet)).toBe(true);
    }
    for (const sheet of MISSING_SHEETS) {
      expect(sheet in GAME_ASSETS).toBe(false);
    }
  });

  it('keeps the sounds optional so the game runs without Web Audio', () => {
    expect([GAME_ASSETS.shot, GAME_ASSETS.explosion, GAME_ASSETS.hit]).toEqual([
      expect.objectContaining({ kind: 'audio', optional: true }),
      expect.objectContaining({ kind: 'audio', optional: true }),
      expect.objectContaining({ kind: 'audio', optional: true }),
    ]);
  });

  it('cuts every sheet with the frame data of the game configuration', () => {
    const sprites = createGameSprites(IMAGES);

    const raven = NIGHT_ENEMIES.find((enemy) => enemy.id === 'night-raven');
    expect(sprites.enemies['enemy_raven']?.frames).toHaveLength(raven?.sprite.frames ?? -1);
    expect(sprites.enemies['enemy_raven']?.frames[1]).toEqual({
      x: raven?.sprite.frameWidth,
      y: 0,
      width: raven?.sprite.frameWidth,
      height: raven?.sprite.frameHeight,
    });
    expect(sprites.enemies['enemy-day-1']).toBeUndefined();
    expect(sprites.projectile.frames).toEqual([{ x: 0, y: 0, width: 10, height: 3 }]);
    expect(sprites.explosions.map((atlas) => [atlas.image, atlas.frames.length])).toEqual([
      ['smoke', RULES.explosion.frames],
      ['fire', RULES.explosion.frames],
    ]);
  });
});
