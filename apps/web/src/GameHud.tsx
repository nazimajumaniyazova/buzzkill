import { type Game, RULES } from '@buzzkill/game';
import { type JSX, useCallback, useSyncExternalStore } from 'react';

interface GameHudProps {
  readonly game: Game;
}

/**
 * Score, lives and ammo over the canvas. The values come from `game.subscribe` through
 * `useSyncExternalStore`, so React renders only when one of them changes, never once per tick.
 * The pause and the end of the run are the machine's business, through the bridge.
 */
export function GameHud({ game }: GameHudProps): JSX.Element {
  const subscribe = useCallback((onChange: () => void) => game.subscribe(onChange), [game]);
  const getHud = useCallback(() => game.getHud(), [game]);
  const hud = useSyncExternalStore(subscribe, getHud);

  return (
    <section className="hud" aria-label="Game status">
      <dl>
        <div>
          <dt>Score</dt>
          <dd>{hud.score}</dd>
        </div>
        <div>
          <dt>Lives</dt>
          <dd>
            {hud.lives} of {RULES.lives}
          </dd>
        </div>
        <div>
          <dt>Ammo</dt>
          <dd>{hud.ammo}</dd>
        </div>
      </dl>
    </section>
  );
}
