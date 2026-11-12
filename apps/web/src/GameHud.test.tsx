import type { Game, GameHud as Hud } from '@buzzkill/game';
import { act, render, screen, within } from '@testing-library/react';
import { Profiler, type ProfilerOnRenderCallback } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { GameHud } from './GameHud';
import { i18nFor, I18nProvider } from './i18n/i18n';

/** A game whose HUD the test sets by hand. */
function createFakeGame() {
  let hud: Hud = {
    score: 0,
    lives: 5,
    ammo: 20,
    level: 1,
    mode: 'day',
    status: 'playing',
    paused: false,
  };
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
    nextLevel: vi.fn(),
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
  it('shows score, lives, ammo and the level, and passes the accessibility check', async () => {
    const { values, container } = setup();

    expect(screen.getAllByRole('term').map((term) => term.textContent)).toEqual([
      'Score',
      'Lives',
      'Ammo',
      'Level',
    ]);
    expect(values()).toEqual(['0', '5 of 5', '20', '1 of 6']);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('names and writes the values in the language of its provider', () => {
    const fake = createFakeGame();
    render(
      <I18nProvider i18n={i18nFor('ru')}>
        <GameHud game={fake.game} />
      </I18nProvider>,
    );
    fake.update({ score: 12345, lives: 3 });

    const hud = screen.getByRole('region', { name: 'Состояние игры' });
    expect(
      within(hud)
        .getAllByRole('term')
        .map((term) => term.textContent),
    ).toEqual(['Счёт', 'Жизни', 'Патроны', 'Уровень']);
    expect(
      within(hud)
        .getAllByRole('definition')
        .map((value) => value.textContent),
    ).toEqual(['12 345', '3 из 5', '20', '1 из 6']);
  });

  it('renders the values the game publishes', () => {
    const { update, values } = setup();

    update({ score: 7, ammo: 12, lives: 3, level: 4 });

    expect(values()).toEqual(['7', '3 of 5', '12', '4 of 6']);
  });

  it('subscribes once per value it shows', () => {
    const { listeners } = setup();

    expect(listeners.size).toBe(4);
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
