import type { ActionInput } from '@buzzkill/engine';
import { attachPointerButton, attachPointerStick } from '@buzzkill/engine/browser';
import type { GameAction } from '@buzzkill/game';
import { type JSX, useEffect, useRef } from 'react';

import { useI18n } from './i18n/i18n';

interface TouchControlsProps {
  /** The input of the run, once it has started; the stick and the fire button hold its actions. */
  readonly input: ActionInput<GameAction> | null;
  readonly onPause: () => void;
  /** Whether the world is too small this way up and would be bigger sideways (#153). */
  readonly suggestLandscape: boolean;
}

/**
 * How far the knob travels from the center, in percent of its own height. It is half as tall as
 * the stick, so a quarter of the stick above or below the center puts it at the edge.
 */
const KNOB_TRAVEL = 50;

/**
 * The controls of a touch screen (#153): a stick at the bottom left to move, a fire button at the
 * bottom right and a pause button at the top right, beside the HUD. CSS shows them only where the
 * primary pointer is coarse, a finger, and the game view stops the browser's own gestures there.
 *
 * The stick and the fire button stand in for keys, which a keyboard or a screen reader already
 * reach, so they are hidden from assistive technology. The pause button is a real button, so a
 * screen reader on a phone can pause too: it pauses the game directly, as the machine does.
 */
export function TouchControls({
  input,
  onPause,
  suggestLandscape,
}: TouchControlsProps): JSX.Element {
  const { t } = useI18n();
  const stickRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLSpanElement>(null);
  const fireRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stick = stickRef.current;
    const knob = knobRef.current;
    const fire = fireRef.current;
    if (input === null || stick === null || knob === null || fire === null) {
      return;
    }
    const detachStick = attachPointerStick(input, { up: 'moveUp', down: 'moveDown' }, stick, {
      // Straight to the style: a move per frame is no reason to render.
      onMove: (offset) => {
        knob.style.transform = `translateY(${String(offset * KNOB_TRAVEL)}%)`;
      },
    });
    const detachFire = attachPointerButton(input, 'fire', fire);
    return () => {
      detachFire();
      detachStick();
    };
  }, [input]);

  return (
    <div className="touch-controls">
      <button type="button" className="touch-pause" aria-label={t.actions.pause} onClick={onPause}>
        <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
          <rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor" />
          <rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor" />
        </svg>
      </button>
      {suggestLandscape && <p className="touch-hint">{t.game.turnSideways}</p>}
      {/* Test ids: hidden from assistive technology, these have no role to be found by. */}
      <div ref={stickRef} className="touch-stick" aria-hidden="true" data-testid="touch-stick">
        <span ref={knobRef} className="touch-stick-knob" data-testid="touch-stick-knob" />
      </div>
      <div ref={fireRef} className="touch-fire" aria-hidden="true" data-testid="touch-fire">
        <svg viewBox="0 0 24 24" width="32" height="32">
          <circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
          <circle cx="12" cy="12" r="2" fill="currentColor" />
          <path d="M12 1v5M12 18v5M1 12h5M18 12h5" stroke="currentColor" strokeWidth="2" />
        </svg>
      </div>
    </div>
  );
}
