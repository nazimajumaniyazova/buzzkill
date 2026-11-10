import { Button, Stack } from '@buzzkill/ui';
import { type JSX, useEffect, useRef } from 'react';

import type { ErrorArea } from './errors/report-error';
import { useI18n } from './i18n/i18n';

interface ErrorScreenProps {
  /** What stopped: the whole shell, or a run of the game. */
  readonly area: ErrorArea;
  /** Back to the menu. */
  readonly onRestart: () => void;
}

/**
 * What the player sees after an unexpected error (#113): what stopped, in plain words, and
 * Restart, which returns to the menu. The details go to the report, not to the screen. Focus moves
 * to Restart, because the control that had it is gone.
 */
export function ErrorScreen({ area, onRestart }: ErrorScreenProps): JSX.Element {
  const { t } = useI18n();
  const restartRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    restartRef.current?.focus();
  }, []);

  return (
    <div className="screen" role="alert">
      <Stack gap="lg" align="center">
        <h1>{t.error.title}</h1>
        <p>{t.error.areas[area]}</p>
        <Button ref={restartRef} size="lg" onClick={onRestart}>
          {t.error.restart}
        </Button>
      </Stack>
    </div>
  );
}
