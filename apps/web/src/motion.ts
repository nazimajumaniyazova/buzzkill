/** The player's motion setting: follow `prefers-reduced-motion`, or reduced or full regardless. */
export type MotionChoice = 'system' | 'reduced' | 'full';

/**
 * Sets the motion preference on the root element (#114). `system` removes the attribute, and the
 * design system then follows `prefers-reduced-motion`; `reduced` and `full` pin it. Today it
 * shortens the interface's animations to nothing; the slower parallax of stage 6 and the screen
 * shake of stage 7 will read the same setting.
 */
export function applyMotion(motion: MotionChoice, root: Element = document.documentElement): void {
  if (motion === 'system') {
    root.removeAttribute('data-motion');
  } else {
    root.setAttribute('data-motion', motion);
  }
}
