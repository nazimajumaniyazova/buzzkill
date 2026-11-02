// cspell:ignore explotions Explostion
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Enemy1, Enemy2, Enemy3, EnemyNight1, EnemyNight2, EnemyNight3 } from '../Enemy';
import { Projectile } from '../Projectile';
import { UI } from '../UI';
import { advancePast, createGame } from './helpers';

/**
 * Characterization tests: they describe what the 2023 code does today, bugs included, so the
 * refactor of stage 3 changes behavior only on purpose. A failing test here means "something
 * changed", not "something is wrong".
 */
describe('legacy Game: initial state', () => {
  it('starts with 20 of 50 rounds, 5 lives, no score and the win threshold at 100', () => {
    const game = createGame();

    expect(game.ammo).toBe(20);
    expect(game.maxAmmo).toBe(50);
    expect(game.lives).toBe(5);
    expect(game.score).toBe(0);
    expect(game.winningScore).toBe(100);
    expect(game.gameOver).toBe(false);
    expect(game.keys).toEqual([]);
    expect(game.enemies).toEqual([]);
  });

  it('spawns an enemy every 1700 ms and reloads a round every 200 ms', () => {
    const game = createGame();

    expect(game.enemyInterval).toBe(1700);
    expect(game.ammoInterval).toBe(200);
  });

  it('uses black HUD text by day and white by night', () => {
    expect(new UI(createGame({ mode: 'day' })).color).toBe('black');
    expect(new UI(createGame({ mode: 'night' })).color).toBe('white');
  });
});

describe('legacy Game: ammo reload', () => {
  it('adds one round on the update after the timer has exceeded 200 ms, not at 200 ms', () => {
    const game = createGame();
    game.ammo = 10;

    game.update(200);
    game.update(1);
    expect(game.ammo).toBe(10);

    game.update(0);
    expect(game.ammo).toBe(11);
  });

  it('never reloads past the maximum of 50', () => {
    const game = createGame();
    game.ammo = 50;

    advancePast(game, game.ammoInterval);

    expect(game.ammo).toBe(50);
  });
});

describe('legacy Game: enemy waves', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('spawns the first enemy on the update after 1700 ms have passed', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    const game = createGame();

    game.update(1700);
    game.update(1);
    expect(game.enemies).toHaveLength(0);

    game.update(0);
    expect(game.enemies).toHaveLength(1);
  });

  it('picks the daytime insect by the random draw: below 0.3, below 0.6, otherwise', () => {
    const game = createGame({ mode: 'day' });
    const random = vi.spyOn(Math, 'random');

    random.mockReturnValue(0.1);
    game.addEnemy();
    random.mockReturnValue(0.45);
    game.addEnemy();
    random.mockReturnValue(0.9);
    game.addEnemy();

    expect(game.enemies[0]).toBeInstanceOf(Enemy1);
    expect(game.enemies[1]).toBeInstanceOf(Enemy2);
    expect(game.enemies[2]).toBeInstanceOf(Enemy3);
  });

  it('picks the night creatures with the same thresholds', () => {
    const game = createGame({ mode: 'night' });
    const random = vi.spyOn(Math, 'random');

    random.mockReturnValue(0.1);
    game.addEnemy();
    random.mockReturnValue(0.45);
    game.addEnemy();
    random.mockReturnValue(0.9);
    game.addEnemy();

    expect(game.enemies[0]).toBeInstanceOf(EnemyNight1);
    expect(game.enemies[1]).toBeInstanceOf(EnemyNight2);
    expect(game.enemies[2]).toBeInstanceOf(EnemyNight3);
  });

  it('gives every enemy 1 to 5 lives and a score equal to its lives', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const game = createGame();

    game.addEnemy();

    expect(game.enemies[0].lives).toBe(5);
    expect(game.enemies[0].score).toBe(5);
  });

  it('shortens the spawn interval by 100 ms per update after 20 s, down to 400 ms', () => {
    const game = createGame();
    game.gameTime = 20_001;

    game.update(0);
    expect(game.enemyInterval).toBe(1600);

    for (let i = 0; i < 30; i++) {
      game.update(0);
    }
    expect(game.enemyInterval).toBe(400);
  });

  it('does not ramp the difficulty before 20 s', () => {
    const game = createGame();
    game.gameTime = 19_999;

    game.update(0);

    expect(game.enemyInterval).toBe(1700);
  });
});

describe('legacy Game: collisions and the end of the game', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function gameWithEnemyAt(x: number, y: number, randomValue = 0.1) {
    vi.spyOn(Math, 'random').mockReturnValue(randomValue);
    const game = createGame();
    game.addEnemy();
    const enemy = game.enemies[0];
    enemy.x = x;
    enemy.y = y;
    return { game, enemy };
  }

  it('costs a life, removes the enemy and adds an explosion when the hero touches an enemy', () => {
    const { game } = gameWithEnemyAt(20, 100);

    game.update(0);

    expect(game.lives).toBe(4);
    expect(game.enemies).toHaveLength(0);
    expect(game.explotions).toHaveLength(1);
    expect(game.gameOver).toBe(false);
  });

  it('ends the game when the last life is lost', () => {
    const { game } = gameWithEnemyAt(20, 100);
    game.lives = 1;

    game.update(0);

    expect(game.lives).toBe(0);
    expect(game.gameOver).toBe(true);
  });

  it('kills a one-life enemy with one projectile and scores its value', () => {
    const { game, enemy } = gameWithEnemyAt(300, 150);
    const projectile = new Projectile(game, enemy.x, enemy.y);
    game.player.projectiles.push(projectile);

    game.update(0);

    expect(game.enemies).toHaveLength(0);
    expect(game.score).toBe(1);
    expect(game.explotions).toHaveLength(1);
    // The hero filters spent projectiles before the collision loop runs, so the projectile that
    // just hit is only marked now and disappears on the next update.
    expect(projectile.markedForDeletion).toBe(true);
    expect(game.player.projectiles).toHaveLength(1);
    game.update(0);
    expect(game.player.projectiles).toHaveLength(0);
  });

  it('only wounds an enemy with more than one life', () => {
    const { game, enemy } = gameWithEnemyAt(300, 150, 0.99);
    game.player.projectiles.push(new Projectile(game, enemy.x, enemy.y));

    game.update(0);

    expect(enemy.lives).toBe(4);
    expect(game.enemies).toHaveLength(1);
    expect(game.score).toBe(0);
  });

  it('is won when the score exceeds 100; reaching exactly 100 is not enough', () => {
    const reaching = gameWithEnemyAt(300, 150);
    reaching.game.score = 99;
    reaching.game.player.projectiles.push(
      new Projectile(reaching.game, reaching.enemy.x, reaching.enemy.y),
    );
    reaching.game.update(0);
    expect(reaching.game.score).toBe(100);
    expect(reaching.game.gameOver).toBe(false);

    const exceeding = gameWithEnemyAt(300, 150);
    exceeding.game.score = 100;
    exceeding.game.player.projectiles.push(
      new Projectile(exceeding.game, exceeding.enemy.x, exceeding.enemy.y),
    );
    exceeding.game.update(0);
    expect(exceeding.game.score).toBe(101);
    expect(exceeding.game.gameOver).toBe(true);
  });

  it('keeps spawning and moving nothing new once the game is over but still counts time out', () => {
    const game = createGame();
    game.gameOver = true;

    advancePast(game, game.enemyInterval);

    expect(game.enemies).toHaveLength(0);
    expect(game.gameTime).toBe(0);
  });

  it('detects overlap with an axis-aligned bounding box test', () => {
    const { game, enemy } = gameWithEnemyAt(300, 150);
    const touching = new Projectile(game, enemy.x + enemy.width - 1, enemy.y + 1);
    const apart = new Projectile(game, enemy.x + enemy.width + 1, enemy.y + 1);

    expect(game.checkCollision(touching, enemy)).toBe(true);
    expect(game.checkCollision(apart, enemy)).toBe(false);
  });
});
