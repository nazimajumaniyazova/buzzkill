import { Button } from '@buzzkill/ui';
import { type JSX, useId } from 'react';

interface PauseDialogProps {
  readonly onResume: () => void;
  readonly onQuit: () => void;
}

/** The `paused` state over the canvas. The design-system `Dialog` replaces it in #108. */
export function PauseDialog({ onResume, onQuit }: PauseDialogProps): JSX.Element {
  const titleId = useId();

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <h2 id={titleId}>Paused</h2>
      <div className="actions">
        <Button
          // The dialog appears in response to the player's own key press.
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus
          onClick={onResume}
        >
          Resume
        </Button>
        <Button variant="secondary" onClick={onQuit}>
          Quit to menu
        </Button>
      </div>
    </div>
  );
}
