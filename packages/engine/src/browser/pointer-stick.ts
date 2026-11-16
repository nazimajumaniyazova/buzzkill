import type { ActionInput } from '../input/action-input';

/** The part of a `PointerEvent` the stick reads. */
export interface StickEventLike {
  readonly pointerId: number;
  readonly clientY: number;
  preventDefault(): void;
}

type StickEventType =
  'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel' | 'lostpointercapture';

/** The part of an `HTMLElement` a stick listens on and measures, so tests can pass a fake. */
export interface StickTarget {
  addEventListener(type: StickEventType, listener: (event: StickEventLike) => void): void;
  removeEventListener(type: StickEventType, listener: (event: StickEventLike) => void): void;
  setPointerCapture(pointerId: number): void;
  getBoundingClientRect(): { readonly top: number; readonly height: number };
}

/** The actions a vertical stick holds: one while it is pushed up, the other while down. */
export interface StickActions<A extends string> {
  readonly up: A;
  readonly down: A;
}

export interface PointerStickOptions {
  /**
   * The part of the travel around the center that steers nowhere, from 0 to below 1: a resting
   * thumb is never quite still. Default `DEFAULT_STICK_DEAD_ZONE`.
   */
  readonly deadZone?: number;
  /** Called with the offset of the knob, from -1 at the top to 1 at the bottom, 0 at rest. */
  readonly onMove?: (offset: number) => void;
}

/** A quarter of the travel: small enough to steer at once, big enough for a thumb to rest. */
export const DEFAULT_STICK_DEAD_ZONE = 0.25;

/**
 * Where a finger is on a stick, as a fraction of its travel from the center: -1 at the top edge or
 * above it, 1 at the bottom edge or below it. A stick with no size steers nowhere.
 */
export function stickOffset(distance: number, travel: number): number {
  if (!(travel > 0)) {
    return 0;
  }
  return Math.min(1, Math.max(-1, distance / travel));
}

/**
 * The way an offset steers: -1 up and 1 down once it is past the dead zone, 0 inside it, the edge
 * included.
 */
export function stickDirection(offset: number, deadZone: number): -1 | 0 | 1 {
  if (offset < -deadZone) {
    return -1;
  }
  return offset > deadZone ? 1 : 0;
}

const END_EVENTS = ['pointerup', 'pointercancel', 'lostpointercapture'] as const;

/**
 * Turns an element into a vertical stick for touch screens (and mouse): a finger above its center
 * holds `actions.up`, below it `actions.down`, and near the center neither. One axis is enough for
 * a hero who only moves up and down; the actions are digital, like the keys they stand in for.
 *
 * The first finger to land steers until it lifts, and the others are ignored meanwhile. Its pointer
 * is captured, so it keeps steering when it slides off the stick, as a thumb does. The stick is
 * measured when a finger lands, not per move: a layout read per event would be wasted, and the
 * stick does not move under a finger. Returns the function that removes the listeners and lets go.
 */
export function attachPointerStick<A extends string>(
  input: ActionInput<A>,
  actions: StickActions<A>,
  target: StickTarget,
  options: PointerStickOptions = {},
): () => void {
  const { deadZone = DEFAULT_STICK_DEAD_ZONE, onMove } = options;
  if (!(deadZone >= 0 && deadZone < 1)) {
    throw new RangeError(`attachPointerStick: deadZone must be in [0, 1), got ${String(deadZone)}`);
  }
  // Unique per stick, so the same pointer on a button and on the stick never collides.
  const prefix = `stick:${actions.up}:${actions.down}:`;
  const source = `${prefix}finger`;

  let pointerId: number | undefined;
  let center = 0;
  let travel = 0;

  const steer = (offset: number): void => {
    const direction = stickDirection(offset, deadZone);
    if (direction === -1) {
      input.press(actions.up, source);
    } else {
      input.release(actions.up, source);
    }
    if (direction === 1) {
      input.press(actions.down, source);
    } else {
      input.release(actions.down, source);
    }
    onMove?.(offset);
  };

  const onDown = (event: StickEventLike): void => {
    // Stops the browser from scrolling, zooming or synthesizing mouse events.
    event.preventDefault();
    if (pointerId !== undefined) {
      return;
    }
    pointerId = event.pointerId;
    target.setPointerCapture(event.pointerId);
    const { top, height } = target.getBoundingClientRect();
    center = top + height / 2;
    travel = height / 2;
    steer(stickOffset(event.clientY - center, travel));
  };
  const onMoveEvent = (event: StickEventLike): void => {
    if (event.pointerId === pointerId) {
      steer(stickOffset(event.clientY - center, travel));
    }
  };
  const onEnd = (event: StickEventLike): void => {
    if (event.pointerId === pointerId) {
      pointerId = undefined;
      steer(0);
    }
  };

  target.addEventListener('pointerdown', onDown);
  target.addEventListener('pointermove', onMoveEvent);
  for (const type of END_EVENTS) {
    target.addEventListener(type, onEnd);
  }

  return () => {
    target.removeEventListener('pointerdown', onDown);
    target.removeEventListener('pointermove', onMoveEvent);
    for (const type of END_EVENTS) {
      target.removeEventListener(type, onEnd);
    }
    pointerId = undefined;
    input.releaseSources(prefix);
    onMove?.(0);
  };
}
