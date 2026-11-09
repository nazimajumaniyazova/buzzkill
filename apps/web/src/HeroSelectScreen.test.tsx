import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { HeroSelectScreen } from './HeroSelectScreen';

describe('HeroSelectScreen', () => {
  it('offers the heroes, the time of day and the volume with sensible defaults', async () => {
    const { container } = render(<HeroSelectScreen onStart={vi.fn()} onBack={vi.fn()} />);

    expect(screen.getByRole('heading', { level: 1, name: 'Choose your hero' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Mike' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Julie' })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: 'Day' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Night' })).not.toBeChecked();
    expect(screen.getByRole('slider', { name: 'Sound volume' })).toHaveValue('0.3');
    expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('starts with the chosen hero and settings', () => {
    const onStart = vi.fn();
    render(<HeroSelectScreen onStart={onStart} onBack={vi.fn()} />);

    fireEvent.click(screen.getByRole('radio', { name: 'Julie' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Night' }));
    fireEvent.change(screen.getByRole('slider', { name: 'Sound volume' }), {
      target: { value: '0.7' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));

    expect(onStart).toHaveBeenCalledExactlyOnceWith({
      heroId: 'female',
      mode: 'night',
      volume: 0.7,
    });
  });

  it('goes back without starting', () => {
    const onStart = vi.fn();
    const onBack = vi.fn();
    render(<HeroSelectScreen onStart={onStart} onBack={onBack} />);

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));

    expect(onBack).toHaveBeenCalledOnce();
    expect(onStart).not.toHaveBeenCalled();
  });
});
