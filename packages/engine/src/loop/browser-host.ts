import type { GameLoopHost } from './game-loop';

/** The slice of `window` the browser host touches, so a test can hand in a fake. */
export interface BrowserHostGlobals {
  requestAnimationFrame(callback: (timeMs: number) => void): number;
  cancelAnimationFrame(handle: number): void;
  readonly document: {
    readonly hidden: boolean;
    addEventListener(type: 'visibilitychange', listener: () => void): void;
    removeEventListener(type: 'visibilitychange', listener: () => void): void;
  };
}

/**
 * `GameLoopHost` on `requestAnimationFrame` and the Page Visibility API. Browsers already throttle
 * or stop animation frames in a hidden tab; the explicit subscription is what lets the loop forget
 * the time spent hidden instead of simulating it in one burst when the tab comes back.
 */
export function createBrowserHost(globals: BrowserHostGlobals = window): GameLoopHost {
  return {
    requestFrame: (callback) => globals.requestAnimationFrame(callback),
    cancelFrame: (handle) => {
      globals.cancelAnimationFrame(handle);
    },
    subscribeVisibility(listener) {
      const onChange = (): void => {
        listener(globals.document.hidden);
      };
      globals.document.addEventListener('visibilitychange', onChange);
      return () => {
        globals.document.removeEventListener('visibilitychange', onChange);
      };
    },
  };
}
