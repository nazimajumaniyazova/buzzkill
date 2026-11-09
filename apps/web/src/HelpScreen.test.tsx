import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { HelpScreen } from './HelpScreen';

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
    const { container } = render(<HelpScreen onBack={vi.fn()} />);

    expect(screen.getByRole('heading', { level: 1, name: 'Help' })).toBeInTheDocument();
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
    expect(screen.getByRole('region', { name: 'In the menus' })).toHaveTextContent('B goes back');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('prints the symbol of a key once and keeps its name for assistive technology', () => {
    render(<HelpScreen onBack={vi.fn()} />);

    const keyboard = screen.getByRole('region', { name: 'Keyboard' });
    expect(within(keyboard).getAllByText('↑')).toHaveLength(1);
    expect(within(keyboard).getAllByText('Arrow up')).toHaveLength(1);
  });

  it('goes back', () => {
    const onBack = vi.fn();
    render(<HelpScreen onBack={onBack} />);

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));

    expect(onBack).toHaveBeenCalledOnce();
  });
});
