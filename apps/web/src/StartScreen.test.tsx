import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { StartScreen } from './StartScreen';

describe('StartScreen', () => {
  it('offers the heroes, the time of day, the volume and the theme with sensible defaults', () => {
    render(<StartScreen theme="system" onThemeChange={vi.fn()} onStart={vi.fn()} />);

    expect(screen.getByRole('heading', { level: 1, name: 'Buzzkill' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Mike' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Julie' })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: 'Day' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Night' })).not.toBeChecked();
    expect(screen.getByRole('slider', { name: 'Sound volume' })).toHaveValue('0.3');
    expect(screen.getByRole('radio', { name: 'Match the system' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Always night' })).not.toBeChecked();
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();
  });

  it('starts the game with the chosen hero and settings', () => {
    const onStart = vi.fn();
    render(<StartScreen theme="system" onThemeChange={vi.fn()} onStart={onStart} />);

    fireEvent.click(screen.getByRole('radio', { name: 'Julie' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Night' }));
    fireEvent.change(screen.getByRole('slider', { name: 'Sound volume' }), {
      target: { value: '0.7' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));

    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onStart).toHaveBeenCalledWith({
      heroId: 'female',
      mode: 'night',
      volume: 0.7,
    });
  });

  it('reports a theme pick and shows the theme it is given', () => {
    const onThemeChange = vi.fn();
    const { rerender } = render(
      <StartScreen theme="system" onThemeChange={onThemeChange} onStart={vi.fn()} />,
    );

    fireEvent.click(screen.getByRole('radio', { name: 'Always night' }));

    expect(onThemeChange).toHaveBeenCalledExactlyOnceWith('night');

    rerender(<StartScreen theme="night" onThemeChange={onThemeChange} onStart={vi.fn()} />);

    expect(screen.getByRole('radio', { name: 'Always night' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Match the system' })).not.toBeChecked();
  });

  it('has no accessibility violations', async () => {
    const { container } = render(
      <StartScreen theme="system" onThemeChange={vi.fn()} onStart={vi.fn()} />,
    );

    expect(await axe(container)).toHaveNoViolations();
  });
});
