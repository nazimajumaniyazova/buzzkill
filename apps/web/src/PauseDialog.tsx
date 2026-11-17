import { Button, Dialog, Inline } from '@buzzkill/ui';
import type { JSX } from 'react';

import { useI18n } from './i18n/i18n';
import type { PauseReason } from './state/machine';

interface PauseDialogProps {
  /** Why the run is paused; a lost gamepad is said in the description (#154). */
  readonly reason?: PauseReason;
  readonly onResume: () => void;
  readonly onQuit: () => void;
}

/**
 * The `paused` state over the canvas. Escape and the close button resume, like the pause key. The
 * description, which a screen reader reads as the dialog opens, says why when the player did not
 * ask for the pause.
 */
export function PauseDialog({
  reason = 'player',
  onResume,
  onQuit,
}: PauseDialogProps): JSX.Element {
  const { t } = useI18n();

  return (
    <Dialog
      open
      title={t.pause.title}
      description={reason === 'gamepadLost' ? t.pause.gamepadLost : t.pause.description}
      closeLabel={t.common.close}
      onClose={onResume}
    >
      <Inline gap="lg" justify="center">
        <Button onClick={onResume}>{t.pause.resume}</Button>
        <Button variant="secondary" onClick={onQuit}>
          {t.pause.quit}
        </Button>
      </Inline>
    </Dialog>
  );
}
