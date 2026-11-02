import type { ActionInput } from '../input/action-input';

/** The part of a `PointerEvent` the source reads. */
export interface PointerEventLike {
  readonly pointerId: number;
  preventDefault(): void;
}

/** The part of an `HTMLElement` an on-screen button listens on, so tests can pass a fake. */
export interface PointerTarget {
  addEventListener(
    type: 'pointerdown' | 'pointerup' | 'pointercancel' | 'pointerleave',
    listener: (event: PointerEventLike) => void,
  ): void;
  removeEventListener(
    type: 'pointerdown' | 'pointerup' | 'pointercancel' | 'pointerleave',
    listener: (event: PointerEventLike) => void,
  ): void;
}

const RELEASE_EVENTS = ['pointerup', 'pointercancel', 'pointerleave'] as const;

/**
 * Turns an element into an on-screen button for `action`, for touch screens (and mouse). Pointer
 * events cover both, and each finger is its own source, so two fingers on one button hold it
 * until both lift. A finger sliding off the button releases it, like a physical button would.
 * Returns the function that removes the listeners and releases the button.
 */
export function attachPointerButton<A extends string>(
  input: ActionInput<A>,
  action: A,
  target: PointerTarget,
): () => void {
  // Unique per button, so the same pointer id on two buttons never collides.
  const prefix = `pointer:${action}:`;

  const onDown = (event: PointerEventLike): void => {
    // Stops the browser from synthesizing mouse events and scrolling or zooming the page.
    event.preventDefault();
    input.press(action, prefix + String(event.pointerId));
  };
  const onUp = (event: PointerEventLike): void => {
    input.release(action, prefix + String(event.pointerId));
  };

  target.addEventListener('pointerdown', onDown);
  for (const type of RELEASE_EVENTS) {
    target.addEventListener(type, onUp);
  }

  return () => {
    target.removeEventListener('pointerdown', onDown);
    for (const type of RELEASE_EVENTS) {
      target.removeEventListener(type, onUp);
    }
    input.releaseSources(prefix);
  };
}
