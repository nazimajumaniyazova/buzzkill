import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { applyMotion, reducesMotion, usePrefersReducedMotion } from './motion';

describe('applyMotion', () => {
  afterEach(() => {
    document.documentElement.removeAttribute('data-motion');
  });

  it('pins reduced or full motion on the root element and lets system remove it', () => {
    const root = document.createElement('div');

    applyMotion('reduced', root);
    expect(root).toHaveAttribute('data-motion', 'reduced');
    applyMotion('full', root);
    expect(root).toHaveAttribute('data-motion', 'full');
    applyMotion('system', root);
    expect(root).not.toHaveAttribute('data-motion');

    applyMotion('reduced');
    expect(document.documentElement).toHaveAttribute('data-motion', 'reduced');
  });
});

describe('reducesMotion', () => {
  it('follows the setting, and the system only when the setting says so', () => {
    expect(reducesMotion('reduced', false)).toBe(true);
    expect(reducesMotion('full', true)).toBe(false);
    expect(reducesMotion('system', true)).toBe(true);
    expect(reducesMotion('system', false)).toBe(false);
  });
});

describe('usePrefersReducedMotion', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reads the system's prefers-reduced-motion and follows its changes", () => {
    const listeners = new Set<() => void>();
    const query = {
      matches: false,
      addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
      removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
    };
    const matchMedia = vi.fn(() => query);
    vi.stubGlobal('matchMedia', matchMedia);

    const { result, unmount } = renderHook(() => usePrefersReducedMotion());

    expect(result.current).toBe(false);
    expect(matchMedia).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)');
    act(() => {
      query.matches = true;
      for (const listener of listeners) {
        listener();
      }
    });
    expect(result.current).toBe(true);
    unmount();
    expect(listeners.size).toBe(0);
  });

  it('is false where the browser cannot tell', () => {
    // Like jsdom and some embedded browsers.
    vi.stubGlobal('matchMedia', undefined);

    const { result } = renderHook(() => usePrefersReducedMotion());

    expect(result.current).toBe(false);
  });
});
