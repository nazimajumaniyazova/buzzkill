import type { RunResult } from '@buzzkill/game';
import { Button, Dialog, Inline } from '@buzzkill/ui';
import type { JSX } from 'react';

interface RunOverDialogProps {
  /** "Level complete" or "Game over": the state the run ended in. */
  readonly title: string;
  readonly result: RunResult;
  readonly onPlayAgain: () => void;
  readonly onQuit: () => void;
}

/**
 * The `levelComplete` and `gameOver` states over the canvas, where the world still moves for the
 * picture. Escape and the close button go back to the menu.
 */
export function RunOverDialog({
  title,
  result,
  onPlayAgain,
  onQuit,
}: RunOverDialogProps): JSX.Element {
  return (
    <Dialog open title={title} description={`Score: ${String(result.score)}`} onClose={onQuit}>
      <Inline gap="lg" justify="center">
        <Button onClick={onPlayAgain}>Play again</Button>
        <Button variant="secondary" onClick={onQuit}>
          Back to menu
        </Button>
      </Inline>
    </Dialog>
  );
}
