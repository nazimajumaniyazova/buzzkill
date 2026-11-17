import { ACHIEVEMENTS, noProgress } from '@buzzkill/game';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { AchievementsScreen } from './AchievementsScreen';
import { i18nFor, I18nProvider } from './i18n/i18n';

describe('AchievementsScreen', () => {
  it('lists every achievement with what it asks and how far the player is, and passes axe', async () => {
    const progress = { ...noProgress(), firstSwat: 1, swatter: 42 };
    const { container } = render(<AchievementsScreen progress={progress} onBack={vi.fn()} />);

    expect(screen.getByRole('heading', { level: 1, name: 'Achievements' })).toBeInTheDocument();
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(ACHIEVEMENTS.length);

    const swatter = within(items[1] as HTMLElement);
    expect(swatter.getByRole('heading', { name: 'Swatter' })).toBeInTheDocument();
    expect(swatter.getByText('Destroy 500 insects.')).toBeInTheDocument();
    const bar = swatter.getByRole('progressbar', { name: 'Swatter' });
    expect(bar).toHaveAttribute('value', '42');
    expect(bar).toHaveAttribute('max', '500');
    expect(swatter.getByText('42 of 500')).toBeInTheDocument();

    const first = within(items[0] as HTMLElement);
    expect(first.getByText('Earned')).toBeInTheDocument();
    expect(screen.getAllByText('Earned')).toHaveLength(1);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('goes back', () => {
    const onBack = vi.fn();
    render(<AchievementsScreen progress={noProgress()} onBack={onBack} />);

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));

    expect(onBack).toHaveBeenCalledOnce();
  });

  it('speaks Russian, with the plural of the count', () => {
    render(
      <I18nProvider i18n={i18nFor('ru')}>
        <AchievementsScreen progress={{ ...noProgress(), nightShift: 21 }} onBack={vi.fn()} />
      </I18nProvider>,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Достижения' })).toBeInTheDocument();
    expect(screen.getByText('Уничтожьте 100 насекомых ночью.')).toBeInTheDocument();
    expect(screen.getByText('Соберите 25 бонусов.')).toBeInTheDocument();
    expect(screen.getByText('21 из 100')).toBeInTheDocument();
  });
});
