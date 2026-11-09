// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

import { createStore } from './store';

interface Count {
  readonly value: number;
}

type CountEvent = { readonly type: 'increment' } | { readonly type: 'reset' };

/** A reset of an already reset counter returns the same state, like the machine's no-op events. */
function count(state: Count, event: CountEvent): Count {
  switch (event.type) {
    case 'increment':
      return { value: state.value + 1 };
    case 'reset':
      return state.value === 0 ? state : { value: 0 };
  }
}

describe('createStore', () => {
  it('starts with the initial state', () => {
    const initial: Count = { value: 3 };
    const store = createStore(count, initial);

    expect(store.getState()).toBe(initial);
  });

  it('applies the transition and notifies once per change', () => {
    const store = createStore(count, { value: 0 });
    const listener = vi.fn();
    store.subscribe(listener);

    store.send({ type: 'increment' });
    store.send({ type: 'increment' });

    expect(store.getState()).toEqual({ value: 2 });
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('does not notify when the transition returns the same state', () => {
    const initial: Count = { value: 0 };
    const store = createStore(count, initial);
    const listener = vi.fn();
    store.subscribe(listener);

    store.send({ type: 'reset' });

    expect(store.getState()).toBe(initial);
    expect(listener).not.toHaveBeenCalled();
  });

  it('stops notifying a listener once it unsubscribes', () => {
    const store = createStore(count, { value: 0 });
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    store.send({ type: 'increment' });
    unsubscribe();
    store.send({ type: 'increment' });

    expect(listener).toHaveBeenCalledOnce();
    expect(store.getState()).toEqual({ value: 2 });
  });

  it('notifies every listener of a change even when one unsubscribes during it', () => {
    const store = createStore(count, { value: 0 });
    const second = vi.fn();
    const unsubscribeFirst = store.subscribe(() => {
      unsubscribeFirst();
    });
    store.subscribe(second);

    store.send({ type: 'increment' });

    expect(second).toHaveBeenCalledOnce();
  });

  it('lets a listener send an event: everyone reads the final state', () => {
    const store = createStore(count, { value: 0 });
    const seen: number[] = [];
    store.subscribe(() => {
      if (store.getState().value === 1) {
        store.send({ type: 'increment' });
      }
    });
    store.subscribe(() => {
      seen.push(store.getState().value);
    });

    store.send({ type: 'increment' });

    expect(store.getState()).toEqual({ value: 2 });
    expect(seen).toEqual([2, 2]);
  });
});
