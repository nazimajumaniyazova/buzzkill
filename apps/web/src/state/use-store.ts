import { useSyncExternalStore } from 'react';

import type { Store } from './store';

/**
 * Reads `select(state)` from a store and renders again only when that value changes, by
 * `Object.is`. The selector must return a part of the state or a primitive, not a new object per
 * call, or the component would render on every change of the store.
 */
export function useStore<TState, TEvent, TSelected>(
  store: Store<TState, TEvent>,
  select: (state: TState) => TSelected,
): TSelected {
  return useSyncExternalStore(store.subscribe, () => select(store.getState()));
}
