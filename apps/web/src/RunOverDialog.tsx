import type { RunResult } from '@buzzkill/game';
import { Button } from '@buzzkill/ui';
import { type JSX, useId } from 'react';

interface RunOverDialogProps {
  /** "Level complete" or "Game over": the state the run ended in. */
  readonly title: string;
  readonly result: RunResult;
  readonly onPlayAgain: () => void;
  readonly onQuit: () => void;
}

/**
 * The `levelComplete` and `gameOver` states over the canvas, where the world still moves for the
 * picture. The design-system `Dialog` replaces it in #108.
 */
export function RunOverDialog({
  title,
  result,
  onPlayAgain,
  onQuit,
}: RunOverDialogProps): JSX.Element {
  const titleId = useId();

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <h2 id={titleId}>{title}</h2>
      <p role="status">Score: {result.score}</p>
      <div className="actions">
        <Button
          // The dialog appears when the run ends, in the middle of play.
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus
          onClick={onPlayAgain}
        >
          Play again
        </Button>
        <Button variant="secondary" onClick={onQuit}>
          Back to menu
        </Button>
      </div>
    </div>
  );
}
