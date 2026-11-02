import { Game, type GameSettings, type LegacyHero } from '@buzzkill/game/legacy';
import { type JSX, useEffect, useRef, useState } from 'react';

interface GameCanvasProps {
  hero: LegacyHero;
  settings: GameSettings;
}

type Status = 'running' | 'over' | 'unsupported';

/**
 * Mounts the legacy game on a full-screen canvas and drives it with requestAnimationFrame, the
 * way the 2023 app did. The fixed-step engine loop of stage 3 replaces this component.
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

    let previousTimestamp: number | null = null;
    let reportedGameOver = false;
    let frame = 0;
    const animate = (timestamp: number): void => {
      const deltaTime = previousTimestamp === null ? 0 : timestamp - previousTimestamp;
      previousTimestamp = timestamp;
      context.clearRect(0, 0, canvas.width, canvas.height);
      game.draw(context);
      game.update(deltaTime);
      if (game.gameOver && !reportedGameOver) {
        reportedGameOver = true;
        setStatus('over');
      }
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(frame);
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
