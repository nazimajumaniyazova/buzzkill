import { type AssetFailure, createAudioMixer, loadAssets } from '@buzzkill/engine';
import { createBrowserAssetDecoders, createBrowserAudioContext } from '@buzzkill/engine/browser';
import type { GameSound } from '@buzzkill/game';
import { Button, Inline, Stack } from '@buzzkill/ui';
import { type JSX, useEffect, useState } from 'react';

import { GAME_ASSETS } from './game/assets';
import { createGameSprites } from './game/sprites';
import { useI18n } from './i18n/i18n';
import type { AppEvent } from './state/machine';

/** How the boot ends. */
export type BootEvent = Extract<AppEvent, { type: 'booted' | 'bootFailed' }>;

interface BootScreenProps {
  /** Which attempt this is; a new number loads again. */
  readonly attempt: number;
  /** The failures of this attempt, or `null` while it loads. */
  readonly failures: readonly AssetFailure[] | null;
  readonly onEvent: (event: BootEvent) => void;
  readonly onRetry: () => void;
}

/**
 * The boot: loads every asset with a progress bar and reports `booted` with the sprites and the
 * mixer, or `bootFailed` with what failed, which this screen then lists next to a retry. The audio
 * context is created here, before any gesture, because the sounds are decoded on it; it starts
 * playing on the first Play click, through `audio.unlock`.
 */
export function BootScreen({ attempt, failures, onEvent, onRetry }: BootScreenProps): JSX.Element {
  const { t, format } = useI18n();
  const [fraction, setFraction] = useState(0);

  useEffect(() => {
    if (failures !== null) {
      return;
    }
    let cancelled = false;
    const audioContext = createBrowserAudioContext();
    void loadAssets(GAME_ASSETS, createBrowserAssetDecoders({ audioContext }), {
      onProgress: (progress) => {
        if (!cancelled) {
          setFraction(progress.fraction);
        }
      },
    }).then((result) => {
      if (cancelled || !result.ok) {
        void audioContext?.close();
        if (!cancelled && !result.ok) {
          onEvent({ type: 'bootFailed', failures: result.failures });
        }
        return;
      }
      const { assets } = result;
      const audio = createAudioMixer<GameSound, AudioBuffer>({
        context: audioContext,
        buffers: { shot: assets.shot, explosion: assets.explosion, hit: assets.hit },
      });
      onEvent({ type: 'booted', assets: { sprites: createGameSprites(assets), audio } });
    });
    return () => {
      cancelled = true;
    };
  }, [attempt, failures, onEvent]);

  if (failures !== null) {
    return (
      <div className="screen" role="alert">
        <Stack gap="lg" align="center">
          <h1>{t.boot.failed}</h1>
          <ul>
            {failures.map((failure) => (
              <li key={failure.id}>
                {t.boot.failure({
                  file: failure.url.split('/').at(-1) ?? failure.url,
                  reason: t.boot.reasons[failure.reason],
                })}
              </li>
            ))}
          </ul>
          <Inline justify="center">
            <Button onClick={onRetry}>{t.boot.retry}</Button>
          </Inline>
        </Stack>
      </div>
    );
  }
  return (
    <div className="screen">
      <label>
        {t.boot.loading}
        <progress max={1} value={fraction}>
          {format.percent(fraction)}
        </progress>
      </label>
    </div>
  );
}
