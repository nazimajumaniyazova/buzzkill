import { type AssetFailure, type AudioMixer, createAudioMixer, loadAssets } from '@buzzkill/engine';
import { createBrowserAssetDecoders } from '@buzzkill/engine/browser';
import type { GameSound } from '@buzzkill/game';
import { Button } from '@buzzkill/ui';
import { type JSX, useEffect, useState } from 'react';

import { GAME_ASSETS } from './game/assets';
import { createGameSprites, type GameSprites } from './game/sprites';
import { GameView } from './GameView';
import type { StartChoice } from './StartScreen';

interface GameSessionProps {
  readonly choice: StartChoice;
  /** The page's audio context, started by the Play click; `null` without Web Audio. */
  readonly audioContext: AudioContext | null;
  readonly onExit: () => void;
}

type Phase =
  | { readonly name: 'loading'; readonly fraction: number }
  | { readonly name: 'failed'; readonly failures: readonly AssetFailure[] }
  | {
      readonly name: 'ready';
      readonly sprites: GameSprites<ImageBitmap>;
      readonly audio: AudioMixer<GameSound>;
    };

const REASONS: Readonly<Record<AssetFailure['reason'], string>> = {
  network: 'the network request failed',
  http: 'the server returned an error',
  decode: 'the file is damaged',
  unavailable: 'this browser cannot play it',
  unknown: 'an unexpected error',
};

/**
 * One visit to the game: loads every asset with a progress bar, explains failures with a retry,
 * then hands the loaded sprites and sounds to the game view.
 */
export function GameSession({ choice, audioContext, onExit }: GameSessionProps): JSX.Element {
  const [phase, setPhase] = useState<Phase>({ name: 'loading', fraction: 0 });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void loadAssets(GAME_ASSETS, createBrowserAssetDecoders({ audioContext }), {
      onProgress: ({ fraction }) => {
        if (!cancelled) {
          setPhase({ name: 'loading', fraction });
        }
      },
    }).then((result) => {
      if (cancelled) {
        return;
      }
      if (!result.ok) {
        setPhase({ name: 'failed', failures: result.failures });
        return;
      }
      const { assets } = result;
      const audio = createAudioMixer<GameSound, AudioBuffer>({
        context: audioContext,
        buffers: { shot: assets.shot, explosion: assets.explosion, hit: assets.hit },
        volumes: { effects: choice.volume },
      });
      setPhase({ name: 'ready', sprites: createGameSprites(assets), audio });
    });
    return () => {
      cancelled = true;
    };
  }, [audioContext, choice.volume, attempt]);

  if (phase.name === 'ready') {
    return <GameView choice={choice} sprites={phase.sprites} audio={phase.audio} onExit={onExit} />;
  }
  if (phase.name === 'failed') {
    return (
      <div className="screen" role="alert">
        <h1>The game could not load</h1>
        <ul>
          {phase.failures.map((failure) => (
            <li key={failure.id}>
              {failure.url.split('/').at(-1)}: {REASONS[failure.reason]}
            </li>
          ))}
        </ul>
        <div className="actions">
          <Button
            onClick={() => {
              setPhase({ name: 'loading', fraction: 0 });
              setAttempt((count) => count + 1);
            }}
          >
            Try again
          </Button>
          <Button variant="secondary" onClick={onExit}>
            Back to menu
          </Button>
        </div>
      </div>
    );
  }
  return (
    <div className="screen">
      <label>
        Loading
        <progress max={1} value={phase.fraction}>
          {Math.round(phase.fraction * 100)} %
        </progress>
      </label>
    </div>
  );
}
