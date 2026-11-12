import { DEFAULT_KEY_BINDINGS } from '@buzzkill/game';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { HelpScreen } from './HelpScreen';
import { i18nFor, I18nProvider } from './i18n/i18n';

/**
 * The rows of a controls list as "action: caps". A printed symbol stands before the hidden name
 * of its key in the DOM ("↑Arrow up"); assistive technology reads the name alone.
 */
function rows(name: string): string[] {
  const section = screen.getByRole('region', { name });
  const terms = within(section)
    .getAllByRole('term')
    .map((term) => term.textContent);
  const definitions = within(section)
    .getAllByRole('definition')
    .map((definition) => definition.textContent);
  return terms.map((term, index) => `${term}: ${definitions[index] ?? ''}`);
}

describe('HelpScreen', () => {
  it('lists the keyboard and gamepad controls from the default bindings', async () => {
    const { container } = render(
      <HelpScreen lives={5} keyBindings={DEFAULT_KEY_BINDINGS} onBack={vi.fn()} />,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Help' })).toBeInTheDocument();
    expect(screen.getByText(/5 hits and the run is over.$/)).toBeInTheDocument();
    expect(rows('Keyboard')).toEqual([
      'Move up: ↑Arrow up or W',
      'Move down: ↓Arrow down or S',
      'Shoot: Space or J',
      'Pause: EscEscape or P',
    ]);
    expect(rows('Gamepad')).toEqual([
      'Move up: D-pad up or Left stick',
      'Move down: D-pad down or Left stick',
      'Shoot: A',
      'Pause: Start',
    ]);
    expect(rows('In the menus')).toEqual([
      'Move: Tab or ↑↓←→Arrow keys or D-pad or Left stick',
      'Select: Enter or A',
      'Go back or close a dialog: EscEscape or B',
    ]);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('speaks Russian, with the plural of the hits and the keys named in Russian', () => {
    render(
      <I18nProvider i18n={i18nFor('ru')}>
        <HelpScreen lives={5} keyBindings={DEFAULT_KEY_BINDINGS} onBack={vi.fn()} />
      </I18nProvider>,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Справка' })).toBeInTheDocument();
    expect(screen.getByText(/5 попаданий — и игра окончена.$/)).toBeInTheDocument();
    expect(rows('Клавиатура')).toEqual([
      'Вверх: ↑Стрелка вверх или W',
      'Вниз: ↓Стрелка вниз или S',
      'Стрелять: Пробел или J',
      'Пауза: EscEscape или P',
    ]);
    expect(rows('Геймпад')[0]).toBe('Вверх: Крестовина вверх или Левый стик');
    expect(screen.getByRole('button', { name: 'Назад' })).toBeInTheDocument();
  });

  it('prints the symbol of a key once and keeps its name for assistive technology', () => {
    render(<HelpScreen lives={5} keyBindings={DEFAULT_KEY_BINDINGS} onBack={vi.fn()} />);

    const keyboard = screen.getByRole('region', { name: 'Keyboard' });
    expect(within(keyboard).getAllByText('↑')).toHaveLength(1);
    expect(within(keyboard).getAllByText('Arrow up')).toHaveLength(1);
  });

  it("shows the player's own keys", () => {
    const keyBindings = { ...DEFAULT_KEY_BINDINGS, fire: ['KeyF', 'Digit1'] };
    render(<HelpScreen lives={5} keyBindings={keyBindings} onBack={vi.fn()} />);

    expect(rows('Keyboard')[2]).toBe('Shoot: F or 1');
  });

  it('counts the hits of the difficulty it is given', () => {
    render(<HelpScreen lives={7} keyBindings={DEFAULT_KEY_BINDINGS} onBack={vi.fn()} />);

    expect(screen.getByText(/7 hits and the run is over.$/)).toBeInTheDocument();
  });

  it('goes back', () => {
    const onBack = vi.fn();
    render(<HelpScreen lives={5} keyBindings={DEFAULT_KEY_BINDINGS} onBack={onBack} />);

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));

    expect(onBack).toHaveBeenCalledOnce();
  });
});
