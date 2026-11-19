import { noProgress } from '@buzzkill/game';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { HeroSelectScreen } from './HeroSelectScreen';

describe('HeroSelectScreen', () => {
  it('offers the heroes and the time of day with sensible defaults', async () => {
    const { container } = render(
      <HeroSelectScreen progress={noProgress()} onStart={vi.fn()} onBack={vi.fn()} />,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Choose your hero' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Mike' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Julie' })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: 'Day' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Night' })).not.toBeChecked();
    expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('starts with the chosen hero and time of day', () => {
    const onStart = vi.fn();
    render(<HeroSelectScreen progress={noProgress()} onStart={onStart} onBack={vi.fn()} />);

    fireEvent.click(screen.getByRole('radio', { name: 'Julie' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Night' }));
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));

    expect(onStart).toHaveBeenCalledExactlyOnceWith({ heroId: 'female', mode: 'night' });
  });

  it('sets up the daily run: the hero only, by day, with what the run of the day is (#165)', async () => {
    const onStart = vi.fn();
    const { container } = render(
      <HeroSelectScreen
        daily="2026-11-17"
        progress={noProgress()}
        onStart={onStart}
        onBack={vi.fn()}
      />,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Daily challenge' })).toBeInTheDocument();
    expect(
      screen.getByText(/^November 17, 2026: the same run for everyone today/),
    ).toBeInTheDocument();
    expect(screen.queryByRole('radiogroup', { name: 'Time of day' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: 'Julie' }));
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));

    expect(onStart).toHaveBeenCalledExactlyOnceWith({ heroId: 'female', mode: 'day' });
    expect(await axe(container)).toHaveNoViolations();
  });

  it('shows the heroes that achievements unlock as locked, and says which achievement (#164)', async () => {
    const { container } = render(
      <HeroSelectScreen progress={noProgress()} onStart={vi.fn()} onBack={vi.fn()} />,
    );

    const sam = screen.getByRole('radio', { name: 'Sam' });
    const leo = screen.getByRole('radio', { name: 'Leo' });
    expect(sam).toBeDisabled();
    expect(sam).toHaveAccessibleDescription(
      'Locked: earn the achievement “Regicide”. Defeat the queen.',
    );
    expect(leo).toBeDisabled();
    expect(leo).toHaveAccessibleDescription(
      'Locked: earn the achievement “Champion”. Win the campaign.',
    );
    expect(screen.getByRole('radio', { name: 'Mike' })).toBeEnabled();
    expect(screen.getByRole('radio', { name: 'Mike' })).not.toHaveAccessibleDescription();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('offers a hero once the achievement is earned, in the daily run too', () => {
    const onStart = vi.fn();
    render(
      <HeroSelectScreen
        daily="2026-11-17"
        progress={{ ...noProgress(), regicide: 1 }}
        onStart={onStart}
        onBack={vi.fn()}
      />,
    );

    const sam = screen.getByRole('radio', { name: 'Sam' });
    expect(sam).toBeEnabled();
    expect(sam).not.toHaveAccessibleDescription();
    expect(screen.getByRole('radio', { name: 'Leo' })).toBeDisabled();
    fireEvent.click(sam);
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));

    expect(onStart).toHaveBeenCalledExactlyOnceWith({ heroId: 'sam', mode: 'day' });
  });

  it('goes back without starting', () => {
    const onStart = vi.fn();
    const onBack = vi.fn();
    render(<HeroSelectScreen progress={noProgress()} onStart={onStart} onBack={onBack} />);

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));

    expect(onBack).toHaveBeenCalledOnce();
    expect(onStart).not.toHaveBeenCalled();
  });
});
