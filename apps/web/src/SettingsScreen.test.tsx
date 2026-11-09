import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

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
    expect(screen.getByText('30 %')).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
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

    expect(screen.getByRole('radio', { name: 'Match the system' })).toBeChecked();
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
