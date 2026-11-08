import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useControlled } from './use-controlled';

describe('useControlled', () => {
  it('holds the state itself when the parent gives no value', () => {
    const onChange = vi.fn();
    const { result } = renderHook(() => useControlled<boolean>(undefined, false, onChange));

    expect(result.current[0]).toBe(false);
    act(() => {
      result.current[1](true);
    });
    expect(result.current[0]).toBe(true);
    expect(onChange).toHaveBeenCalledExactlyOnceWith(true);
  });

  it('follows the parent when it controls the value and only reports changes', () => {
    const onChange = vi.fn();
    const { result, rerender } = renderHook(
      ({ value }: { value: boolean }) => useControlled(value, false, onChange),
      { initialProps: { value: true } },
    );

    expect(result.current[0]).toBe(true);
    act(() => {
      result.current[1](false);
    });
    expect(result.current[0]).toBe(true);
    expect(onChange).toHaveBeenCalledExactlyOnceWith(false);

    rerender({ value: false });
    expect(result.current[0]).toBe(false);
  });
});
