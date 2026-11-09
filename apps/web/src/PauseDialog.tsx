import { Button, Dialog, Inline } from '@buzzkill/ui';
import type { JSX } from 'react';

interface PauseDialogProps {
  readonly onResume: () => void;
  readonly onQuit: () => void;
}

/** The `paused` state over the canvas. Escape and the close button resume, like the pause key. */
export function PauseDialog({ onResume, onQuit }: PauseDialogProps): JSX.Element {
  return (
    <Dialog open title="Paused" description="The run waits for you." onClose={onResume}>
      <Inline gap="lg" justify="center">
        <Button onClick={onResume}>Resume</Button>
        <Button variant="secondary" onClick={onQuit}>
          Quit to menu
        </Button>
      </Inline>
    </Dialog>
  );
}
