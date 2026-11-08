import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { Slider } from './Slider';

const percent = (value: number): string => `${String(Math.round(value * 100))} %`;

describe('Slider', () => {
  it('is a slider named by its label with the range and the formatted value', () => {
    render(
      <Slider
        label="Sound volume"
        min={0}
        max={1}
        step={0.1}
        defaultValue={0.3}
        formatValue={percent}
      />,
    );

    const slider = screen.getByRole('slider', { name: 'Sound volume' });
    expect(slider).toHaveAttribute('type', 'range');
    expect(slider).toHaveAttribute('min', '0');
    expect(slider).toHaveAttribute('max', '1');
    expect(slider).toHaveAttribute('step', '0.1');
    expect(slider).toHaveValue('0.3');
    expect(slider).toHaveAttribute('aria-valuetext', '30 %');
    expect(screen.getByText('30 %')).toHaveAttribute('aria-hidden', 'true');
  });

  it('starts at min without a default and reports changes as numbers', () => {
    const onValueChange = vi.fn();
    render(<Slider label="Level" min={1} max={10} onValueChange={onValueChange} />);
    const slider = screen.getByRole('slider', { name: 'Level' });

    expect(slider).toHaveValue('1');
    fireEvent.change(slider, { target: { value: '7' } });
    expect(slider).toHaveValue('7');
    expect(slider).toHaveAttribute('aria-valuetext', '7');
    expect(onValueChange).toHaveBeenCalledExactlyOnceWith(7);
  });

  it('follows the parent when controlled', () => {
    const onValueChange = vi.fn();
    const { rerender } = render(<Slider label="Level" value={4} onValueChange={onValueChange} />);
    const slider = screen.getByRole('slider', { name: 'Level' });

    fireEvent.change(slider, { target: { value: '9' } });
    expect(onValueChange).toHaveBeenCalledExactlyOnceWith(9);
    expect(slider).toHaveValue('4');

    rerender(<Slider label="Level" value={9} onValueChange={onValueChange} />);
    expect(slider).toHaveValue('9');
  });

  it('has no accessibility violations', async () => {
    const { container } = render(
      <Slider
        label="Sound volume"
        min={0}
        max={1}
        step={0.1}
        defaultValue={0.3}
        formatValue={percent}
      />,
    );

    expect(await axe(container)).toHaveNoViolations();
  });
});
