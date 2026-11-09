import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { SettingsScreen } from './SettingsScreen';
import { DEFAULT_SETTINGS } from './state/settings';

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

  it('goes back', () => {
    const onBack = vi.fn();
    render(<SettingsScreen settings={DEFAULT_SETTINGS} onChange={vi.fn()} onBack={onBack} />);

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));

    expect(onBack).toHaveBeenCalledOnce();
  });
});
