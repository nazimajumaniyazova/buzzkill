import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { ErrorScreen } from './ErrorScreen';
import { i18nFor, I18nProvider } from './i18n/i18n';

describe('ErrorScreen', () => {
  it('says in plain words that the run stopped, and passes the accessibility check', async () => {
    const { container } = render(<ErrorScreen area="game" onRestart={vi.fn()} />);

    const alert = screen.getByRole('alert');
    expect(screen.getByRole('heading', { level: 1, name: 'Something went wrong' })).toBeVisible();
    expect(alert).toHaveTextContent(
      'The run stopped on an error we did not expect. Restart takes you back to the menu; your settings are safe.',
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('says that the whole game stopped when the shell failed', () => {
    render(<ErrorScreen area="shell" onRestart={vi.fn()} />);

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Buzzkill stopped on an error we did not expect. Restart opens the menu again; your settings are safe.',
    );
  });

  it('moves focus to Restart, which reports the choice', () => {
    const onRestart = vi.fn();
    render(<ErrorScreen area="game" onRestart={onRestart} />);
    const restart = screen.getByRole('button', { name: 'Restart' });

    expect(restart).toHaveFocus();
    fireEvent.click(restart);
    expect(onRestart).toHaveBeenCalledOnce();
  });

  it('speaks the language of the settings', () => {
    render(
      <I18nProvider i18n={i18nFor('ru')}>
        <ErrorScreen area="game" onRestart={vi.fn()} />
      </I18nProvider>,
    );

    expect(screen.getByRole('heading', { name: 'Что-то пошло не так' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Начать заново' })).toHaveFocus();
  });
});
