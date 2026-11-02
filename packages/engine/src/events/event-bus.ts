/**
 * Typed, synchronous event bus. The simulation announces what happened (a hit, a death, a pickup)
 * and the edges react: the renderer spawns an explosion, the audio plays a sound, the HUD store
 * updates. The event map ties each event name to its payload type at compile time.
 *
 * Emitting allocates nothing. Listeners run synchronously in registration order; a listener
 * added during an emit first runs on the next one, and a listener removed during an emit does not
 * run again in that emit.
 */

export type EventListener<Payload> = (payload: Payload) => void;

export interface EventBus<Events extends object> {
  /** Registers a listener and returns the function that removes it. */
  on<K extends keyof Events>(type: K, listener: EventListener<Events[K]>): () => void;
  /** Removes one registration of `listener`; unknown listeners are ignored. */
  off<K extends keyof Events>(type: K, listener: EventListener<Events[K]>): void;
  /** Calls the listeners of `type` that were registered before this call, in order. */
  emit<K extends keyof Events>(type: K, payload: Events[K]): void;
  listenerCount(type: keyof Events): number;
  /** Removes every listener of every type. */
  clear(): void;
}

// Listeners of every type are stored under the widest contravariant signature; `emit` narrows
// back to the payload type that the event map guarantees for the key.
type StoredListener = EventListener<never>;

interface Registry {
  /** `null` marks a listener removed while an emit was walking the list. */
  readonly listeners: (StoredListener | null)[];
  dirty: boolean;
}

export function createEventBus<Events extends object>(): EventBus<Events> {
  const registries = new Map<keyof Events, Registry>();
  /** Nesting depth of running emits; removals splice only when it is 0. */
  let emitting = 0;
  let anyDirty = false;

  const registryFor = (type: keyof Events): Registry => {
    let registry = registries.get(type);
    if (registry === undefined) {
      registry = { listeners: [], dirty: false };
      registries.set(type, registry);
    }
    return registry;
  };

  /** Drops the tombstones left by removals during emits, in place. */
  const compact = (): void => {
    for (const registry of registries.values()) {
      if (!registry.dirty) {
        continue;
      }
      const { listeners } = registry;
      let write = 0;
      for (const listener of listeners) {
        if (listener !== null) {
          listeners[write] = listener;
          write += 1;
        }
      }
      listeners.length = write;
      registry.dirty = false;
    }
    anyDirty = false;
  };

  const off = <K extends keyof Events>(type: K, listener: EventListener<Events[K]>): void => {
    const registry = registries.get(type);
    if (registry === undefined) {
      return;
    }
    const index = registry.listeners.indexOf(listener);
    if (index === -1) {
      return;
    }
    if (emitting > 0) {
      registry.listeners[index] = null;
      registry.dirty = true;
      anyDirty = true;
    } else {
      registry.listeners.splice(index, 1);
    }
  };

  return {
    on(type, listener) {
      registryFor(type).listeners.push(listener);
      return () => {
        off(type, listener);
      };
    },
    off,
    emit<K extends keyof Events>(type: K, payload: Events[K]): void {
      const registry = registries.get(type);
      if (registry === undefined) {
        return;
      }
      const { listeners } = registry;
      // Listeners added by a listener are appended beyond this length and wait for the next emit.
      const count = listeners.length;
      emitting += 1;
      try {
        for (let index = 0; index < count; index += 1) {
          const listener = listeners[index];
          if (listener !== null && listener !== undefined) {
            // Stored under the widest signature; the key guarantees this payload type.
            (listener as EventListener<Events[K]>)(payload);
          }
        }
      } finally {
        emitting -= 1;
        if (emitting === 0 && anyDirty) {
          compact();
        }
      }
    },
    listenerCount(type) {
      const registry = registries.get(type);
      if (registry === undefined) {
        return 0;
      }
      let count = 0;
      for (const listener of registry.listeners) {
        if (listener !== null) {
          count += 1;
        }
      }
      return count;
    },
    clear() {
      if (emitting > 0) {
        for (const registry of registries.values()) {
          registry.listeners.fill(null);
          registry.dirty = true;
        }
        anyDirty = true;
      } else {
        registries.clear();
      }
    },
  };
}
