// cspell:ignore Explostion
import { afterEach, describe, expect, it, vi } from 'vitest';

import { fireExplostion } from '../Explostion';
import { Projectile } from '../Projectile';
import { createGame } from './helpers';

describe('legacy Projectile and ammo', () => {
  it('does not spend a round when fired', () => {
    const game = createGame();

    game.player.shootTop();

    expect(game.player.projectiles).toHaveLength(1);
    expect(game.ammo).toBe(20);
  });

  it('spends the round when the projectile passes 80 % of the width, where it disappears', () => {
    const game = createGame({ width: 800 });
    const projectile = new Projectile(game, 639, 100);
    game.player.projectiles.push(projectile);

    projectile.update();
    expect(projectile.x).toBe(643);
    expect(projectile.markedForDeletion).toBe(true);
    expect(game.ammo).toBe(19);
  });

  it('flies 4 px per update and stays alive before that line', () => {
    const game = createGame({ width: 800 });
    const projectile = new Projectile(game, 600, 100);

    projectile.update();

    expect(projectile.x).toBe(604);
    expect(projectile.markedForDeletion).toBe(false);
    expect(game.ammo).toBe(20);
  });
});

describe('legacy Enemy movement', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('enters from the right edge and flies left at a random speed between 1.5 and 4.5 px', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const game = createGame({ width: 800 });
    game.addEnemy();
    const enemy = game.enemies[0];

    expect(enemy.x).toBe(800);
    expect(enemy.speedX).toBe(-3);
  });

  it('is removed once it has fully left the screen on the left', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const game = createGame();
    game.addEnemy();
    const enemy = game.enemies[0];
    enemy.x = -enemy.width;

    game.update(0);

    expect(game.enemies).toHaveLength(0);
  });
});

describe('legacy explosion animation', () => {
  it('advances a frame every 33 ms and disappears after the ninth frame', () => {
    const game = createGame();
    const explosion = new fireExplostion(game, 100, 100);

    for (let frame = 0; frame < 8; frame++) {
      explosion.update(34);
      explosion.update(0);
    }
    expect(explosion.frameX).toBe(8);
    expect(explosion.markForDeletion).toBe(false);

    explosion.update(34);
    explosion.update(0);
    expect(explosion.markForDeletion).toBe(true);
  });

  it('drifts left with the background speed', () => {
    const game = createGame();
    const explosion = new fireExplostion(game, 100, 100);
    const startX = explosion.x;

    explosion.update(0);

    expect(explosion.x).toBe(startX - game.speed);
  });
});
