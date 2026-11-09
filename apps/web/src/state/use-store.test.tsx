import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { createStore, type Store } from './store';
import { useStore } from './use-store';

interface Counter {
  readonly value: number;
  readonly label: string;
}

type CounterEvent = { readonly type: 'increment' } | { readonly type: 'relabel' };

function counter(state: Counter, event: CounterEvent): Counter {
  switch (event.type) {
    case 'increment':
      return { ...state, value: state.value + 1 };
    case 'relabel':
      return { ...state, label: `${state.label}!` };
  }
}

/** A store that counts its subscribers. */
function createCountedStore(): Store<Counter, CounterEvent> & {
  readonly subscribers: () => number;
} {
  const store = createStore(counter, { value: 0, label: 'a' });
  let subscribers = 0;
  return {
    ...store,
    subscribe(listener) {
      subscribers += 1;
      const unsubscribe = store.subscribe(listener);
      return () => {
        subscribers -= 1;
        unsubscribe();
      };
    },
    subscribers: () => subscribers,
  };
}

describe('useStore', () => {
  it('returns the selected value and follows its changes', () => {
    const store = createStore(counter, { value: 0, label: 'a' });
    const { result } = renderHook(() => useStore(store, (state) => state.value));

    expect(result.current).toBe(0);

    act(() => {
      store.send({ type: 'increment' });
    });

    expect(result.current).toBe(1);
  });

  it('does not render again when the selected value stays the same', () => {
    const store = createStore(counter, { value: 0, label: 'a' });
    let renders = 0;
    renderHook(() => {
      renders += 1;
      return useStore(store, (state) => state.value);
    });

    act(() => {
      store.send({ type: 'relabel' });
    });

    expect(store.getState().label).toBe('a!');
    expect(renders).toBe(1);
  });

  it('subscribes once and unsubscribes on unmount', () => {
    const store = createCountedStore();
    const { rerender, unmount } = renderHook(() => useStore(store, (state) => state.label));

    rerender();
    expect(store.subscribers()).toBe(1);

    unmount();
    expect(store.subscribers()).toBe(0);
  });
});
