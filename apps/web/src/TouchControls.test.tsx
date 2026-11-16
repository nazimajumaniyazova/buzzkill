import { createActionInput } from '@buzzkill/engine';
import { GAME_ACTIONS } from '@buzzkill/game';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { i18nFor, I18nProvider } from './i18n/i18n';
import { TouchControls } from './TouchControls';

/** jsdom lays nothing out: the stick is given a box, 200 px tall from the top of the page. */
function layOut(stick: Element): void {
  Object.assign(stick, {
    getBoundingClientRect: () => ({ top: 0, height: 200 }),
    setPointerCapture: vi.fn(),
  });
}

/** The stick, its knob and the fire button, which have no role: they are hidden from it. */
function parts() {
  const stick = screen.getByTestId('touch-stick');
  layOut(stick);
  return {
    stick,
    knob: screen.getByTestId('touch-stick-knob'),
    fire: screen.getByTestId('touch-fire'),
  };
}

describe('TouchControls', () => {
  it('names the pause button, hides the stick and the fire button from assistive technology and passes the accessibility check', async () => {
    const { container } = render(
      <TouchControls
        input={createActionInput(GAME_ACTIONS)}
        onPause={vi.fn()}
        suggestLandscape={false}
      />,
    );

    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();
    const { stick, fire } = parts();
    expect(stick).toHaveAttribute('aria-hidden', 'true');
    expect(fire).toHaveAttribute('aria-hidden', 'true');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('pauses by the pause button', () => {
    const onPause = vi.fn();
    render(
      <TouchControls
        input={createActionInput(GAME_ACTIONS)}
        onPause={onPause}
        suggestLandscape={false}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));

    expect(onPause).toHaveBeenCalledOnce();
  });

  it('fires while a finger holds the fire button', () => {
    const input = createActionInput(GAME_ACTIONS);
    render(<TouchControls input={input} onPause={vi.fn()} suggestLandscape={false} />);
    const { fire } = parts();

    fireEvent.pointerDown(fire, { pointerId: 1 });
    expect(input.isHeld('fire')).toBe(true);

    fireEvent.pointerUp(fire, { pointerId: 1 });
    expect(input.isHeld('fire')).toBe(false);
  });

  it('moves the hero with the stick, and its knob with the finger', () => {
    const input = createActionInput(GAME_ACTIONS);
    render(<TouchControls input={input} onPause={vi.fn()} suggestLandscape={false} />);
    const { stick, knob } = parts();

    fireEvent.pointerDown(stick, { pointerId: 1, clientY: 50 });
    expect(input.isHeld('moveUp')).toBe(true);
    expect(knob.style.transform).toBe('translateY(-25%)');

    fireEvent.pointerMove(stick, { pointerId: 1, clientY: 200 });
    expect(input.isHeld('moveUp')).toBe(false);
    expect(input.isHeld('moveDown')).toBe(true);
    expect(knob.style.transform).toBe('translateY(50%)');

    fireEvent.pointerUp(stick, { pointerId: 1 });
    expect(input.isHeld('moveDown')).toBe(false);
    expect(knob.style.transform).toBe('translateY(0%)');
  });

  it('lets go of the input when it unmounts, and of the old input when a new run brings its own', () => {
    const first = createActionInput(GAME_ACTIONS);
    const second = createActionInput(GAME_ACTIONS);
    const { rerender, unmount } = render(
      <TouchControls input={first} onPause={vi.fn()} suggestLandscape={false} />,
    );
    const { stick, fire } = parts();
    fireEvent.pointerDown(fire, { pointerId: 1 });

    rerender(<TouchControls input={second} onPause={vi.fn()} suggestLandscape={false} />);
    expect(first.isHeld('fire')).toBe(false);
    fireEvent.pointerDown(stick, { pointerId: 2, clientY: 10 });
    expect(second.isHeld('moveUp')).toBe(true);
    expect(first.isHeld('moveUp')).toBe(false);

    unmount();
    expect(second.isHeld('moveUp')).toBe(false);
  });

  it('waits for the input of the run before it steers anything', () => {
    render(<TouchControls input={null} onPause={vi.fn()} suggestLandscape={false} />);
    const { stick, knob } = parts();

    fireEvent.pointerDown(stick, { pointerId: 1, clientY: 10 });

    expect(knob.style.transform).toBe('');
  });

  it('suggests turning the phone sideways only when asked to, in the language of the settings', () => {
    const { rerender } = render(
      <TouchControls input={null} onPause={vi.fn()} suggestLandscape={false} />,
    );
    expect(screen.queryByText(/sideways/)).not.toBeInTheDocument();

    rerender(<TouchControls input={null} onPause={vi.fn()} suggestLandscape />);
    expect(screen.getByText('Turn your phone sideways for a bigger picture.')).toBeVisible();

    rerender(
      <I18nProvider i18n={i18nFor('ru')}>
        <TouchControls input={null} onPause={vi.fn()} suggestLandscape />
      </I18nProvider>,
    );
    expect(screen.getByText('Поверните телефон боком — картинка станет больше.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Пауза' })).toBeInTheDocument();
  });
});
