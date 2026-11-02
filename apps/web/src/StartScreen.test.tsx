import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { StartScreen } from './StartScreen';

describe('StartScreen', () => {
  it('offers the heroes, the time of day and the volume with sensible defaults', () => {
    render(<StartScreen onStart={vi.fn()} />);

    expect(screen.getByRole('heading', { level: 1, name: 'Buzzkill' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Mike' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Julie' })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: 'Day' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Night' })).not.toBeChecked();
    expect(screen.getByRole('slider', { name: 'Sound volume' })).toHaveValue('0.3');
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();
  });

  it('starts the game with the chosen hero and settings', () => {
    const onStart = vi.fn();
    render(<StartScreen onStart={onStart} />);

    fireEvent.click(screen.getByRole('radio', { name: 'Julie' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Night' }));
    fireEvent.change(screen.getByRole('slider', { name: 'Sound volume' }), {
      target: { value: '0.7' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));

    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onStart).toHaveBeenCalledWith({
      hero: 'female',
      settings: { mode: 'night', volume: 0.7 },
    });
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<StartScreen onStart={vi.fn()} />);

    expect(await axe(container)).toHaveNoViolations();
  });
});
