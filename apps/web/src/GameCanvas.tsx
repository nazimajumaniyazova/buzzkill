import { createBrowserHost, createGameLoop } from '@buzzkill/engine';
import { Game, type GameSettings, type LegacyHero } from '@buzzkill/game/legacy';
import { type JSX, useEffect, useRef, useState } from 'react';

interface GameCanvasProps {
  hero: LegacyHero;
  settings: GameSettings;
}

type Status = 'running' | 'over' | 'unsupported';

/**
 * Mounts the legacy game on a full-screen canvas and drives it with the engine's fixed-step loop.
 * The 2023 code advanced once per animation frame, so it ran twice as fast on a 120 Hz display;
 * now it gets exactly 60 updates per second and pauses while the tab is hidden. The component
 * itself goes when the new renderer lands (ADR-0004).
 */
export function GameCanvas({ hero, settings }: GameCanvasProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<Status>('running');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) {
      return;
    }
    const context = canvas.getContext('2d');
    if (context === null) {
      setStatus('unsupported');
      return;
    }

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const game = new Game(canvas.width, canvas.height, hero, settings);

    let reportedGameOver = false;
    const loop = createGameLoop(
      {
        update(_tick, stepSeconds) {
          // The legacy update takes the frame delta in milliseconds; it now gets a constant one.
          game.update(stepSeconds * 1000);
          if (game.gameOver && !reportedGameOver) {
            reportedGameOver = true;
            setStatus('over');
          }
        },
        render() {
          // The legacy game draws its current state and cannot interpolate, so alpha is unused.
          context.clearRect(0, 0, canvas.width, canvas.height);
          game.draw(context);
        },
      },
      { host: createBrowserHost() },
    );
    loop.start();

    return () => {
      loop.stop();
    };
  }, [hero, settings]);

  return (
    <>
      <canvas ref={canvasRef} className="game-canvas">
        Buzzkill game screen
      </canvas>
      {status === 'over' && (
        <div className="game-over" role="status">
          <p>Game over.</p>
          {/* The legacy game cannot be restarted in place; a reload is the honest restart. */}
          <button
            type="button"
            onClick={() => {
              window.location.reload();
            }}
          >
            Play again
          </button>
        </div>
      )}
      {status === 'unsupported' && (
        <p role="alert">
          Your browser does not support the canvas element, so the game cannot run.
        </p>
      )}
    </>
  );
}
