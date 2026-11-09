/**
 * A store over a pure transition function: the current state, `send` and a `subscribe` that fits
 * React's `useSyncExternalStore` (ADR-0006). The members are properties, not methods, so they can
 * be passed around detached.
 */
export interface Store<TState, TEvent> {
  /** The current state: the same object until an event changes it. */
  readonly getState: () => TState;
  /** Applies `transition(state, event)` and notifies the listeners if the state changed. */
  readonly send: (event: TEvent) => void;
  /**
   * Calls `listener` after every change; it reads the new state with `getState`. Returns the
   * function that removes it.
   */
  readonly subscribe: (listener: () => void) => () => void;
}

export function createStore<TState, TEvent>(
  transition: (state: TState, event: TEvent) => TState,
  initial: TState,
): Store<TState, TEvent> {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    getState: () => state,
    send(event) {
      const next = transition(state, event);
      if (next === state) {
        return;
      }
      state = next;
      // Over a copy: a listener may unsubscribe itself or another one while being notified.
      for (const listener of [...listeners]) {
        listener();
      }
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
