import type { GameMode } from '@buzzkill/game';
import { Button, Dialog, Inline } from '@buzzkill/ui';
import type { JSX } from 'react';

import type { TimeChange } from './i18n/en';
import { useI18n } from './i18n/i18n';

interface LevelClearedDialogProps {
  /** The level just cleared, from 1. */
  readonly level: number;
  readonly score: number;
  /** The time of day of the cleared level and of the next one. */
  readonly time: GameMode;
  readonly nextTime: GameMode;
  readonly onNext: () => void;
  readonly onQuit: () => void;
}

function timeChange(time: GameMode, nextTime: GameMode): TimeChange {
  if (time === nextTime) {
    return 'none';
  }
  return nextTime === 'night' ? 'nightFalls' : 'dayBreaks';
}

/**
 * The `levelCleared` state over the canvas: the screen between levels (ADR-0017). The game holds
 * the run, simulating nothing, until the player goes on. Escape and the close button go on too,
 * as they resume a pause; leaving the run takes Quit.
 */
export function LevelClearedDialog({
  level,
  score,
  time,
  nextTime,
  onNext,
  onQuit,
}: LevelClearedDialogProps): JSX.Element {
  const { t } = useI18n();

  return (
    <Dialog
      open
      title={t.levelCleared.title(level)}
      description={t.levelCleared.description(score, timeChange(time, nextTime))}
      closeLabel={t.common.close}
      onClose={onNext}
    >
      <Inline gap="lg" justify="center">
        <Button onClick={onNext}>{t.levelCleared.next}</Button>
        <Button variant="secondary" onClick={onQuit}>
          {t.levelCleared.quit}
        </Button>
      </Inline>
    </Dialog>
  );
}
