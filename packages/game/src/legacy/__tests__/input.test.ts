import { describe, expect, it } from 'vitest';

import { createGame } from './helpers';

function press(key: string): void {
  window.dispatchEvent(new KeyboardEvent('keydown', { key }));
}

function release(key: string): void {
  window.dispatchEvent(new KeyboardEvent('keyup', { key }));
}

/**
 * The legacy InputHandler listens on `window` for the lifetime of the page and stores raw key
 * names on the game. These tests pin that behavior, including its known bug.
 */
describe('legacy InputHandler', () => {
  it('records ArrowUp and ArrowDown once each, however often they repeat', () => {
    const game = createGame();

    press('ArrowUp');
    press('ArrowUp');
    press('ArrowDown');

    expect(game.keys).toEqual(['ArrowUp', 'ArrowDown']);
  });

  it('ignores keys other than the arrows and Space', () => {
    const game = createGame();

    press('a');
    press('Enter');

    expect(game.keys).toEqual([]);
  });

  it('removes the last pressed key on release, not the released one (indexOf/splice bug)', () => {
    const game = createGame();
    press('ArrowUp');
    press('ArrowDown');

    release('ArrowUp');

    // `keys.splice(keys.indexOf(key, 1))` searches from index 1, finds nothing, and splice(-1)
    // drops the last element: ArrowDown disappears while ArrowUp stays pressed.
    expect(game.keys).toEqual(['ArrowUp']);
  });

  it('releases a single pressed key correctly, by accident of the same bug', () => {
    const game = createGame();
    press('ArrowUp');

    release('ArrowUp');

    expect(game.keys).toEqual([]);
  });

  it('fires a projectile on Space while rounds remain, and does nothing when empty', () => {
    const game = createGame();

    press(' ');
    expect(game.player.projectiles).toHaveLength(1);

    game.ammo = 0;
    press(' ');
    expect(game.player.projectiles).toHaveLength(1);
  });
});

describe('legacy Player movement', () => {
  it('moves 4 px per update while an arrow is held and stops when none is', () => {
    const game = createGame();
    const startY = game.player.y;

    game.keys.push('ArrowUp');
    game.player.update();
    expect(game.player.y).toBe(startY - 4);

    game.keys.length = 0;
    game.keys.push('ArrowDown');
    game.player.update();
    expect(game.player.y).toBe(startY);

    game.keys.length = 0;
    game.player.update();
    expect(game.player.y).toBe(startY);
  });

  it('keeps the hero between 20 % above the top edge and 80 % above the bottom edge', () => {
    const game = createGame({ height: 600 });
    const { player } = game;

    player.y = -10_000;
    player.update();
    expect(player.y).toBeCloseTo(-player.height * 0.2);

    player.y = 10_000;
    player.update();
    expect(player.y).toBeCloseTo(600 - player.height * 0.8);
  });
});
