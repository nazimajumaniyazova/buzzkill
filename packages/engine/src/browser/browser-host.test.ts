import { describe, expect, it, vi } from 'vitest';

import { type BrowserHostGlobals, createBrowserHost } from './browser-host';

/** Hand-made `window` subset: no jsdom, the engine tests stay in Node. */
function createFakeGlobals() {
  const listeners = new Set<() => void>();
  let hidden = false;
  const requestAnimationFrame = vi.fn((_callback: (timeMs: number) => void) => 7);
  const cancelAnimationFrame = vi.fn();
  const globals: BrowserHostGlobals = {
    requestAnimationFrame,
    cancelAnimationFrame,
    document: {
      get hidden() {
        return hidden;
      },
      addEventListener(_type, listener) {
        listeners.add(listener);
      },
      removeEventListener(_type, listener) {
        listeners.delete(listener);
      },
    },
  };
  return {
    globals,
    requestAnimationFrame,
    cancelAnimationFrame,
    listeners,
    setHidden(value: boolean): void {
      hidden = value;
      for (const listener of listeners) {
        listener();
      }
    },
  };
}

describe('createBrowserHost', () => {
  it('schedules and cancels frames through requestAnimationFrame', () => {
    const fake = createFakeGlobals();
    const host = createBrowserHost(fake.globals);
    const callback = (): void => undefined;

    expect(host.requestFrame(callback)).toBe(7);
    expect(fake.requestAnimationFrame).toHaveBeenCalledWith(callback);

    host.cancelFrame(7);
    expect(fake.cancelAnimationFrame).toHaveBeenCalledWith(7);
  });

  it('reports document.hidden on every visibilitychange until unsubscribed', () => {
    const fake = createFakeGlobals();
    const host = createBrowserHost(fake.globals);
    const listener = vi.fn();

    // The host is typed with the subscription optional; the browser one always has it.
    const unsubscribe = host.subscribeVisibility?.(listener);
    fake.setHidden(true);
    fake.setHidden(false);
    expect(listener.mock.calls).toEqual([[true], [false]]);
    expect(fake.listeners.size).toBe(1);

    unsubscribe?.();
    fake.setHidden(true);
    expect(listener).toHaveBeenCalledTimes(2);
    expect(fake.listeners.size).toBe(0);
  });
});
