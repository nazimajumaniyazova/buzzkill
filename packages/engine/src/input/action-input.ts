/**
 * Input as actions, not keys. Sources (keyboard, pointer, gamepad) translate their own events into
 * `press(action, source)` and `release(action, source)`; the simulation only ever sees which
 * actions are down. That is what makes key remapping trivial and lets a replay record actions
 * (ADR-0009) instead of device events.
 *
 * Every physical control holding an action is tracked by a source id such as `key:ArrowUp`,
 * `pointer:3` or `pad:0:b12`. An action is held while at least one source holds it, so two keys,
 * a finger and a gamepad can hold the same action and releasing one of them keeps it held. A
 * repeated press of the same source (key auto-repeat) changes nothing, and a release of a source
 * that is not holding the action is ignored.
 *
 * The simulation reads the state once per tick with `sample()`. Actions are bits of a 32-bit mask
 * in the order of the action list, which is compact enough to record per tick.
 */

/** One tick's view of the input, as bit masks over the action list. */
export interface InputSnapshot {
  /** Actions held now, or pressed and released again since the previous sample (a quick tap). */
  readonly down: number;
  /** Actions down in this sample that were not down in the previous one. */
  readonly pressed: number;
  /** Actions down in the previous sample that are not down in this one. */
  readonly released: number;
}

export interface ActionInput<A extends string> {
  /** The actions in bit order: action `actions[i]` is bit `1 << i`. */
  readonly actions: readonly A[];
  /** The bit of `action` in the snapshot masks. */
  bit(action: A): number;
  /** Marks `action` as held by `source`. Pressing again with the same source changes nothing. */
  press(action: A, source: string): void;
  /** Ends the hold of `source` on `action`; ignored when that source does not hold it. */
  release(action: A, source: string): void;
  /** Releases every hold of the sources whose id starts with `prefix`, for example `key:`. */
  releaseSources(prefix: string): void;
  /** True while at least one source holds `action`. */
  isHeld(action: A): boolean;
  /**
   * Takes the snapshot for the next tick and starts collecting taps for the one after. The
   * returned object is reused by the next call so that a tick allocates nothing.
   */
  sample(): InputSnapshot;
  /** Releases everything and forgets the previous sample, for a new game. */
  reset(): void;
}

/** True when `action`'s bit is set in `mask`. */
export function isActionDown<A extends string>(
  input: ActionInput<A>,
  mask: number,
  action: A,
): boolean {
  return (mask & input.bit(action)) !== 0;
}

const MAX_ACTIONS = 32;

export function createActionInput<const A extends string>(actions: readonly A[]): ActionInput<A> {
  if (actions.length === 0 || actions.length > MAX_ACTIONS) {
    throw new RangeError(
      `createActionInput: need 1 to ${String(MAX_ACTIONS)} actions, got ${String(actions.length)}`,
    );
  }
  interface Entry {
    readonly bit: number;
    /** Source ids currently holding the action. */
    readonly holders: Set<string>;
  }
  const entries = new Map<A, Entry>();
  actions.forEach((action, index) => {
    if (entries.has(action)) {
      throw new Error(`createActionInput: duplicate action "${action}"`);
    }
    // `| 0` keeps bit 31 a 32-bit integer; masks are compared bitwise, never by sign.
    entries.set(action, { bit: (1 << index) | 0, holders: new Set() });
  });

  let heldMask = 0;
  // Actions pressed at any point since the last sample, so a tap between two ticks is not lost.
  let tappedMask = 0;
  let previousDown = 0;
  const snapshot = { down: 0, pressed: 0, released: 0 };

  const entryOf = (action: A): Entry => {
    const entry = entries.get(action);
    if (entry === undefined) {
      throw new RangeError(`unknown action "${action}"`);
    }
    return entry;
  };

  const releaseEntry = (entry: Entry, source: string): void => {
    if (entry.holders.delete(source) && entry.holders.size === 0) {
      heldMask &= ~entry.bit;
    }
  };

  return {
    actions: [...actions],
    bit: (action) => entryOf(action).bit,
    press(action, source) {
      const entry = entryOf(action);
      entry.holders.add(source);
      heldMask |= entry.bit;
      tappedMask |= entry.bit;
    },
    release(action, source) {
      releaseEntry(entryOf(action), source);
    },
    releaseSources(prefix) {
      for (const entry of entries.values()) {
        // Deleting the current element while iterating a Set is well defined in JavaScript.
        for (const source of entry.holders) {
          if (source.startsWith(prefix)) {
            releaseEntry(entry, source);
          }
        }
      }
    },
    isHeld(action) {
      return (heldMask & entryOf(action).bit) !== 0;
    },
    sample() {
      const down = heldMask | tappedMask;
      snapshot.down = down;
      snapshot.pressed = down & ~previousDown;
      snapshot.released = previousDown & ~down;
      previousDown = down;
      tappedMask = 0;
      return snapshot;
    },
    reset() {
      for (const entry of entries.values()) {
        entry.holders.clear();
      }
      heldMask = 0;
      tappedMask = 0;
      previousDown = 0;
    },
  };
}
