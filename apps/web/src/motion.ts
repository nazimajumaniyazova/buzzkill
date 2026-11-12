import { useSyncExternalStore } from 'react';

/** The player's motion setting: follow `prefers-reduced-motion`, or reduced or full regardless. */
export type MotionChoice = 'system' | 'reduced' | 'full';

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/**
 * Sets the motion preference on the root element (#114). `system` removes the attribute, and the
 * design system then follows `prefers-reduced-motion`; `reduced` and `full` pin it. It shortens the
 * interface's animations to nothing; the game's canvas reads the same choice through
 * `reducesMotion` (#133), and so will the screen shake of stage 7.
 */
export function applyMotion(motion: MotionChoice, root: Element = document.documentElement): void {
  if (motion === 'system') {
    root.removeAttribute('data-motion');
  } else {
    root.setAttribute('data-motion', motion);
  }
}

/** Whether motion is reduced: by the setting, or by the system when the setting follows it. */
export function reducesMotion(motion: MotionChoice, systemPrefersReduced: boolean): boolean {
  return motion === 'reduced' || (motion === 'system' && systemPrefersReduced);
}

/**
 * Whether the system asks for reduced motion (`prefers-reduced-motion`), following its changes;
 * `false` where the browser cannot tell. The interface reads the preference in CSS, the canvas
 * needs it in code.
 */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, prefersReducedMotion, () => false);
}

function reducedMotionQuery(): MediaQueryList | null {
  // The DOM types promise `matchMedia` on every window; jsdom and some embedded browsers lack it.
  const { matchMedia } = globalThis as Partial<Pick<typeof globalThis, 'matchMedia'>>;
  return matchMedia === undefined ? null : globalThis.matchMedia(REDUCED_MOTION_QUERY);
}

function prefersReducedMotion(): boolean {
  return reducedMotionQuery()?.matches ?? false;
}

function subscribe(onChange: () => void): () => void {
  const query = reducedMotionQuery();
  query?.addEventListener('change', onChange);
  return () => {
    query?.removeEventListener('change', onChange);
  };
}
