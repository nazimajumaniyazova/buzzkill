import { Button, Inline, Stack } from '@buzzkill/ui';
import type { JSX } from 'react';

import { useI18n } from './i18n/i18n';
import type { GameLoad } from './state/game-loader';

interface LoadingScreenProps {
  /** Where the game's loading stands. */
  readonly load: GameLoad;
  /** Loads the files again after some failed. */
  readonly onRetry: () => void;
  /** Reloads the page after the game's code failed to download. */
  readonly onReload: () => void;
  readonly onBack: () => void;
}

/** How far the loading has come: 0 before it starts, the files' fraction, then 1. */
function progressOf(load: Extract<GameLoad, { status: 'idle' | 'loading' | 'ready' }>): number {
  switch (load.status) {
    case 'idle':
      return 0;
    case 'loading':
      return load.fraction;
    case 'ready':
      return 1;
  }
}

/**
 * The `loading` state (#112): the run waits here while the game's code and files finish loading,
 * with the progress of the files. A failure says what failed and offers the way out that can fix
 * it: loading the files again, or reloading the page when the code itself is missing, which
 * happens when a new deploy replaced the chunk this page knows. Back returns to the hero select;
 * the loading goes on.
 */
export function LoadingScreen({
  load,
  onRetry,
  onReload,
  onBack,
}: LoadingScreenProps): JSX.Element {
  const { t, format } = useI18n();
  const back = (
    <Button variant="secondary" onClick={onBack}>
      {t.common.back}
    </Button>
  );

  switch (load.status) {
    case 'codeFailed':
      return (
        <div className="screen" role="alert">
          <Stack gap="lg" align="center">
            <h1>{t.loading.failed}</h1>
            <p>{t.loading.codeFailed}</p>
            <Inline justify="center">
              <Button onClick={onReload}>{t.loading.reload}</Button>
              {back}
            </Inline>
          </Stack>
        </div>
      );
    case 'assetsFailed':
      return (
        <div className="screen" role="alert">
          <Stack gap="lg" align="center">
            <h1>{t.loading.failed}</h1>
            <ul>
              {load.failures.map((failure) => (
                <li key={failure.id}>
                  {t.loading.failure({
                    file: failure.url.split('/').at(-1) ?? failure.url,
                    reason: t.loading.reasons[failure.reason],
                  })}
                </li>
              ))}
            </ul>
            <Inline justify="center">
              <Button onClick={onRetry}>{t.loading.retry}</Button>
              {back}
            </Inline>
          </Stack>
        </div>
      );
    case 'idle':
    case 'loading':
    case 'ready': {
      const fraction = progressOf(load);
      return (
        <div className="screen">
          <Stack gap="lg" align="center">
            <label>
              {t.loading.progress}
              <progress max={1} value={fraction}>
                {format.percent(fraction)}
              </progress>
            </label>
            {back}
          </Stack>
        </div>
      );
    }
  }
}
