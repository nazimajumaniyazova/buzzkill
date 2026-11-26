import { Button, Inline, Stack } from '@buzzkill/ui';
import type { JSX } from 'react';

import type { ReplayProblem } from './backend/replays';
import { useI18n } from './i18n/i18n';

interface StoredReplayScreenProps {
  /** Why the replay cannot be watched, or `null` while it is fetched. */
  readonly problem: ReplayProblem | null;
  /** Fetches the replay again; offered only when trying again can help. */
  readonly onRetry: () => void;
  readonly onBack: () => void;
}

/**
 * The wait for the replay of a run of the boards (#219), and why it cannot be watched when it
 * cannot. The wait is a status, a failure an alert, so a screen reader hears both. Only a
 * network failure offers to try again: a run that is gone, or of another version, stays so.
 */
export function StoredReplayScreen({
  problem,
  onRetry,
  onBack,
}: StoredReplayScreenProps): JSX.Element {
  const { t } = useI18n();
  const back = (
    <Button variant="secondary" onClick={onBack}>
      {t.common.back}
    </Button>
  );

  if (problem === null) {
    return (
      <div className="screen">
        <Stack gap="lg" align="center">
          <h1>{t.replay.label}</h1>
          <p role="status">{t.replay.loading}</p>
          {back}
        </Stack>
      </div>
    );
  }
  return (
    <div className="screen">
      <Stack gap="lg" align="center">
        <h1>{t.replay.label}</h1>
        <p role="alert">{t.replay.problems[problem]}</p>
        <Inline justify="center">
          {problem === 'offline' && <Button onClick={onRetry}>{t.replay.retry}</Button>}
          {back}
        </Inline>
      </Stack>
    </div>
  );
}
