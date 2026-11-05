import { DEFAULT_KEY_BINDINGS, type Game, RULES } from '@buzzkill/game';
import { type JSX, useCallback, useEffect, useSyncExternalStore } from 'react';

interface GameHudProps {
  readonly game: Game;
  readonly onPlayAgain: () => void;
  readonly onExit: () => void;
}

const PAUSE_KEYS: readonly string[] = DEFAULT_KEY_BINDINGS.pause;

/**
 * Score, lives and ammo over the canvas, plus the pause and game-over dialogs. The values come
 * from `game.subscribe` through `useSyncExternalStore`, so React renders only when one of them
 * changes, never once per tick.
 */
export function GameHud({ game, onPlayAgain, onExit }: GameHudProps): JSX.Element {
  const subscribe = useCallback((onChange: () => void) => game.subscribe(onChange), [game]);
  const getHud = useCallback(() => game.getHud(), [game]);
  const hud = useSyncExternalStore(subscribe, getHud);
  const over = hud.status !== 'playing';

  useEffect(() => {
    if (!hud.paused) {
      return;
    }
    // The loop does not sample input while paused, so the pause key resumes from here.
    const onKeyDown = (event: KeyboardEvent): void => {
      if (PAUSE_KEYS.includes(event.code)) {
        event.preventDefault();
        game.resume();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [game, hud.paused]);

  return (
    <>
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

      {hud.paused && !over && (
        <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="paused-title">
          <h2 id="paused-title">Paused</h2>
          <div className="actions">
            <button
              type="button"
              // The dialog appears in response to the player's own key press.
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus
              onClick={() => {
                game.resume();
              }}
            >
              Resume
            </button>
            <button type="button" onClick={onExit}>
              Quit to menu
            </button>
          </div>
        </div>
      )}

      {over && (
        <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="over-title">
          <h2 id="over-title">{hud.status === 'won' ? 'You won!' : 'Game over'}</h2>
          <p role="status">Score: {hud.score}</p>
          <div className="actions">
            <button
              type="button"
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus
              onClick={onPlayAgain}
            >
              Play again
            </button>
            <button type="button" onClick={onExit}>
              Back to menu
            </button>
          </div>
        </div>
      )}
    </>
  );
}
