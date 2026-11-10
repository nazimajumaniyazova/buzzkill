import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { i18nFor, I18nProvider } from './i18n/i18n';
import { SettingsScreen } from './SettingsScreen';
import { DEFAULT_SETTINGS } from './state/settings/schema';

describe('SettingsScreen', () => {
  it('shows the sound tab first, with the switch and the two volumes, and passes the accessibility check', async () => {
    const { container } = render(
      <SettingsScreen settings={DEFAULT_SETTINGS} onChange={vi.fn()} onBack={vi.fn()} />,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Sound' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('switch', { name: 'Sound' })).toBeChecked();
    expect(screen.getByRole('slider', { name: 'Effects volume' })).toHaveValue('0.3');
    expect(screen.getByRole('slider', { name: 'Music volume' })).toHaveValue('0.5');
    expect(screen.getByText('30%')).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: 'Effects volume' })).toHaveAttribute(
      'aria-valuetext',
      '30%',
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('speaks the language of its provider, percentages included', () => {
    render(
      <I18nProvider i18n={i18nFor('ru')}>
        <SettingsScreen settings={DEFAULT_SETTINGS} onChange={vi.fn()} onBack={vi.fn()} />
      </I18nProvider>,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Настройки' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Звук' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('slider', { name: 'Громкость эффектов' })).toHaveAttribute(
      'aria-valuetext',
      '30 %',
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Игра' }));
    expect(screen.getByRole('radio', { name: '100 %' })).toBeChecked();
  });

  it('reports every sound change as the fields that changed', () => {
    const onChange = vi.fn();
    render(<SettingsScreen settings={DEFAULT_SETTINGS} onChange={onChange} onBack={vi.fn()} />);

    fireEvent.click(screen.getByRole('switch', { name: 'Sound' }));
    fireEvent.change(screen.getByRole('slider', { name: 'Effects volume' }), {
      target: { value: '0.7' },
    });
    fireEvent.change(screen.getByRole('slider', { name: 'Music volume' }), {
      target: { value: '0' },
    });

    expect(onChange.mock.calls).toEqual([
      [{ muted: true }],
      [{ effectsVolume: 0.7 }],
      [{ musicVolume: 0 }],
    ]);
  });

  it('shows the settings it is given: a muted switch is off', () => {
    render(
      <SettingsScreen
        settings={{ ...DEFAULT_SETTINGS, muted: true }}
        onChange={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    expect(screen.getByRole('switch', { name: 'Sound' })).not.toBeChecked();
  });

  it('offers the theme on the display tab and passes the accessibility check there too', async () => {
    const onChange = vi.fn();
    const { container } = render(
      <SettingsScreen settings={DEFAULT_SETTINGS} onChange={onChange} onBack={vi.fn()} />,
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Display' }));

    const theme = within(screen.getByRole('group', { name: 'Theme' }));
    expect(theme.getByRole('radio', { name: 'Match the system' })).toBeChecked();
    fireEvent.click(screen.getByRole('radio', { name: 'Always night' }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith({ theme: 'night' });
    expect(await axe(container)).toHaveNoViolations();
  });

  it('offers the language on the display tab', () => {
    const onChange = vi.fn();
    render(<SettingsScreen settings={DEFAULT_SETTINGS} onChange={onChange} onBack={vi.fn()} />);

    fireEvent.click(screen.getByRole('tab', { name: 'Display' }));

    expect(screen.getByRole('radio', { name: 'English' })).toBeChecked();
    fireEvent.click(screen.getByRole('radio', { name: 'Русский' }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith({ language: 'ru' });
  });

  it('offers the motion on the display tab, the system by default', () => {
    const onChange = vi.fn();
    render(<SettingsScreen settings={DEFAULT_SETTINGS} onChange={onChange} onBack={vi.fn()} />);

    fireEvent.click(screen.getByRole('tab', { name: 'Display' }));
    const motion = within(screen.getByRole('group', { name: 'Motion' }));

    expect(motion.getAllByRole('radio').map((radio) => radio.getAttribute('value'))).toEqual([
      'system',
      'reduced',
      'full',
    ]);
    expect(motion.getByRole('radio', { name: 'Match the system' })).toBeChecked();
    fireEvent.click(motion.getByRole('radio', { name: 'Reduced' }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith({ motion: 'reduced' });
  });

  it('offers the game speed on the gameplay tab, with what a slower game means', () => {
    const onChange = vi.fn();
    render(
      <SettingsScreen
        settings={{ ...DEFAULT_SETTINGS, gameSpeed: 0.75 }}
        onChange={onChange}
        onBack={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Gameplay' }));
    const speed = within(screen.getByRole('group', { name: 'Game speed' }));

    expect(speed.getAllByRole('radio').map((radio) => radio.getAttribute('value'))).toEqual([
      '1',
      '0.75',
      '0.5',
    ]);
    expect(speed.getByRole('radio', { name: '75%' })).toBeChecked();
    expect(screen.getByText(/Only games at 100% enter the leaderboard\.$/)).toBeInTheDocument();
    fireEvent.click(speed.getByRole('radio', { name: '50%' }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith({ gameSpeed: 0.5 });
  });

  it('offers the difficulty on the gameplay tab, and passes the accessibility check there', async () => {
    const onChange = vi.fn();
    const { container } = render(
      <SettingsScreen
        settings={{ ...DEFAULT_SETTINGS, difficulty: 'hard' }}
        onChange={onChange}
        onBack={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Gameplay' }));

    expect(screen.getByRole('radio', { name: 'Hard' })).toBeChecked();
    fireEvent.click(screen.getByRole('radio', { name: 'Easy' }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith({ difficulty: 'easy' });
    expect(await axe(container)).toHaveNoViolations();
  });

  it('edits the keys on the controls tab and reports them as one change', async () => {
    const onChange = vi.fn();
    const { container } = render(
      <SettingsScreen settings={DEFAULT_SETTINGS} onChange={onChange} onBack={vi.fn()} />,
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Controls' }));
    fireEvent.click(screen.getByRole('button', { name: 'Shoot, key 2: J' }));
    fireEvent.keyDown(document.body, { key: 'f', code: 'KeyF' });

    expect(onChange).toHaveBeenCalledExactlyOnceWith({
      keyBindings: { ...DEFAULT_SETTINGS.keyBindings, fire: ['Space', 'KeyF'] },
    });
    expect(await axe(container)).toHaveNoViolations();
  });

  it('goes back', () => {
    const onBack = vi.fn();
    render(<SettingsScreen settings={DEFAULT_SETTINGS} onChange={vi.fn()} onBack={onBack} />);

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));

    expect(onBack).toHaveBeenCalledOnce();
  });
});
