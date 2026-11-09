import type { Game, GameHud } from '@buzzkill/game';
import { useCallback, useSyncExternalStore } from 'react';

/**
 * Reads `select(hud)` from a running game and renders again only when that value changes, by
 * `Object.is`. The game publishes a new HUD object at most once per frame and only when one of
 * its values changed (#40); the selector narrows that further to the one value a component shows,
 * so a change of the ammo does not render the score. The selector returns a primitive: a number
 * or a string built from the HUD, never a new object per call.
 */
export function useGameHud<T extends number | string | boolean>(
  game: Game,
  select: (hud: GameHud) => T,
): T {
  const subscribe = useCallback((onChange: () => void) => game.subscribe(onChange), [game]);
  return useSyncExternalStore(subscribe, () => select(game.getHud()));
}
