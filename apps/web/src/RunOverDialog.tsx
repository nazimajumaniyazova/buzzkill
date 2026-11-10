import type { RunResult } from '@buzzkill/game';
import { Button, Dialog, Inline } from '@buzzkill/ui';
import type { JSX } from 'react';

import { useI18n } from './i18n/i18n';

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
  const { t } = useI18n();

  return (
    <Dialog
      open
      title={title}
      description={t.runOver.score(result.score)}
      closeLabel={t.common.close}
      onClose={onQuit}
    >
      <Inline gap="lg" justify="center">
        <Button onClick={onPlayAgain}>{t.runOver.playAgain}</Button>
        <Button variant="secondary" onClick={onQuit}>
          {t.runOver.quit}
        </Button>
      </Inline>
    </Dialog>
  );
}
