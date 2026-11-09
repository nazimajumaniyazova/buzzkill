import type { Game, GameHud as Hud } from '@buzzkill/game';
import { act, render, screen, within } from '@testing-library/react';
import { Profiler, type ProfilerOnRenderCallback } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { GameHud } from './GameHud';

/** A game whose HUD the test sets by hand. */
function createFakeGame() {
  let hud: Hud = { score: 0, lives: 5, ammo: 20, status: 'playing', paused: false };
  const listeners = new Set<(hud: Hud) => void>();
  const game = {
    start: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    dispose: vi.fn(),
    subscribe: vi.fn((listener: (hud: Hud) => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }),
    getHud: () => hud,
    replay: vi.fn(),
    result: vi.fn(),
  } satisfies Game;
  function update(change: Partial<Hud>): void {
    hud = { ...hud, ...change };
    act(() => {
      for (const listener of listeners) {
        listener(hud);
      }
    });
  }
  return { game, update, listeners };
}

function setup() {
  const fake = createFakeGame();
  const onRender = vi.fn<ProfilerOnRenderCallback>();
  const view = render(
    <Profiler id="hud" onRender={onRender}>
      <GameHud game={fake.game} />
    </Profiler>,
  );
  /** Score, lives and ammo as shown. */
  const values = () =>
    within(screen.getByRole('region', { name: 'Game status' }))
      .getAllByRole('definition')
      .map((value) => value.textContent);
  /** The commits after the first render. */
  const updates = () => onRender.mock.calls.filter(([, phase]) => phase !== 'mount').length;
  return { ...fake, values, updates, ...view };
}

describe('GameHud', () => {
  it('shows score, lives and ammo and passes the accessibility check', async () => {
    const { values, container } = setup();

    expect(screen.getAllByRole('term').map((term) => term.textContent)).toEqual([
      'Score',
      'Lives',
      'Ammo',
    ]);
    expect(values()).toEqual(['0', '5 of 5', '20']);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('renders the values the game publishes', () => {
    const { update, values } = setup();

    update({ score: 7, ammo: 12, lives: 3 });

    expect(values()).toEqual(['7', '3 of 5', '12']);
  });

  it('subscribes once per value it shows', () => {
    const { listeners } = setup();

    expect(listeners.size).toBe(3);
  });

  it('commits only when a value it shows changes, once per publication', () => {
    const { update, updates } = setup();

    update({ paused: true });
    update({ paused: false });
    update({});
    expect(updates()).toBe(0);

    update({ score: 1 });
    update({ ammo: 19, lives: 4 });
    expect(updates()).toBe(2);
  });

  it('leaves the pause and the end of the run to the machine: no dialog of its own', () => {
    const { update } = setup();

    update({ paused: true });
    update({ status: 'lost' });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
