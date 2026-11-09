import { Button, Dialog, Inline } from '@buzzkill/ui';
import type { JSX } from 'react';

import { useI18n } from './i18n/i18n';

interface PauseDialogProps {
  readonly onResume: () => void;
  readonly onQuit: () => void;
}

/** The `paused` state over the canvas. Escape and the close button resume, like the pause key. */
export function PauseDialog({ onResume, onQuit }: PauseDialogProps): JSX.Element {
  const { t } = useI18n();

  return (
    <Dialog
      open
      title={t.pause.title}
      description={t.pause.description}
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
