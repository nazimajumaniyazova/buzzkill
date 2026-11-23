import { createRng } from '@buzzkill/engine';
import { createBrowserHost } from '@buzzkill/engine/browser';
import {
  createGame,
  createReplayInput,
  DIFFICULTIES,
  type Game,
  type GameMode,
  isRunOver,
  type Replay,
  WORLD,
} from '@buzzkill/game';
import { Button, Inline, RadioGroup } from '@buzzkill/ui';
import { type JSX, useEffect, useRef, useState } from 'react';

import { useAnnounce } from './announcer';
import { announceRun } from './game/announce-run';
import { createGameDrawer } from './game/draw-game';
import { createGameAudio, SOUND_SEED } from './game/game-audio';
import { adjustablePacedHost } from './game/paced-host';
import { attachRunCanvas, catchingHost } from './game/run-canvas';
import { GameHud } from './GameHud';
import { useI18n } from './i18n/i18n';
import type { GameAssets } from './state/machine';
import { useGameHud } from './state/use-game-hud';

/** The paces a replay plays at (#219); the run's own pace setting does not apply to it. */
const REPLAY_SPEEDS = [0.5, 1, 2, 4] as const;
type ReplaySpeed = (typeof REPLAY_SPEEDS)[number];

/** The picture settings of the player, read when the replay starts. */
interface ReplayEffects {
  readonly reducedMotion: boolean;
  readonly particles: boolean;
  readonly screenShake: boolean;
  readonly hitFlash: boolean;
  readonly squashStretch: boolean;
  readonly hitStop: boolean;
}

interface ReplayViewProps {
  /** A replay of this build of the game, from `parseReplay` or a run on this device. */
  readonly replay: Replay;
  readonly assets: GameAssets;
  readonly effects: ReplayEffects;
  /** Hears the time of day of the level on screen, from the first one on (ADR-0017). */
  readonly onTime: (time: GameMode) => void;
  readonly onBack: () => void;
}

/**
 * A stored run, played again on the canvas (#219) by the same `createGame` as a run, with the
 * replay as its input: the same pictures, sounds and HUD, and the same end the server finds. It
 * counts no achievement and plays no haptics, and no key steers it. A cleared level goes straight
 * on to the next, as in `simulate`. The controls pause it, change its pace from 0.5× to 4× and
 * start it again from the beginning with a new run of the same replay.
 *
 * An error in a frame is thrown in the next render, for the error boundary around it (#113).
 */
export function ReplayView({
  replay,
  assets,
  effects,
  onTime,
  onBack,
}: ReplayViewProps): JSX.Element {
  const { t } = useI18n();
  const announce = useAnnounce();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [game, setGame] = useState<Game | null>(null);
  const [unsupported, setUnsupported] = useState(false);
  /** Counts the starts from the beginning: each one is a new run of the same replay. */
  const [generation, setGeneration] = useState(0);
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState<ReplaySpeed>(1);
  const [crash, setCrash] = useState<{ readonly error: unknown } | null>(null);
  // Read by the clock every frame, so a new pace applies without a new run.
  const speedRef = useRef<number>(speed);
  const effectsRef = useRef(effects);
  const onTimeRef = useRef(onTime);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d') ?? null;
    if (canvas === null || context === null) {
      setUnsupported(true);
      return;
    }

    const cleanups: (() => void)[] = [];
    const release = (): void => {
      for (const cleanup of cleanups.splice(0).reverse()) {
        cleanup();
      }
    };

    try {
      const { renderer, dispose: detach } = attachRunCanvas(canvas, context, () => undefined);
      cleanups.push(detach);
      const host = catchingHost(
        adjustablePacedHost(createBrowserHost(), () => speedRef.current),
        (error) => {
          setCrash({ error });
        },
      );
      const fx = effectsRef.current;
      const soundRng = createRng((replay.seed ^ SOUND_SEED) >>> 0);
      const created = createGame({
        settings: {
          heroId: replay.heroId,
          mode: replay.mode,
          difficulty: replay.difficulty,
          daily: replay.daily,
        },
        seed: replay.seed,
        gameVersion: replay.gameVersion,
        input: createReplayInput(replay),
        host,
        renderer: createGameDrawer(renderer, assets.sprites, {
          reducedMotion: () => fx.reducedMotion,
          particles: () => fx.particles,
          screenShake: () => fx.screenShake,
          hitFlash: () => fx.hitFlash,
          squashStretch: () => fx.squashStretch,
          hitStop: () => fx.hitStop,
          seed: replay.seed,
        }),
        audio: createGameAudio(assets.audio, {
          random: () => soundRng.nextFloat(),
          width: WORLD.width,
        }),
      });
      cleanups.push(() => {
        created.dispose();
      });
      setGame(created);
      created.start();
    } catch (error) {
      release();
      throw error;
    }

    return release;
  }, [replay, assets, generation]);

  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  useEffect(() => {
    onTimeRef.current = onTime;
  }, [onTime]);

  // The time of day of each level, and the levels one after another without the screen between.
  useEffect(() => {
    if (game === null) {
      return;
    }
    let time = game.getHud().mode;
    onTimeRef.current(time);
    return game.subscribe((hud) => {
      if (hud.mode !== time) {
        time = hud.mode;
        onTimeRef.current(time);
      }
      if (hud.status === 'levelCleared') {
        // After the frame that cleared the level, which is still running its ticks.
        queueMicrotask(() => {
          game.nextLevel();
        });
      }
    });
  }, [game]);

  // Screen readers hear the replay as they hear a run (#114).
  useEffect(
    () => (game === null ? undefined : announceRun(game, announce, t.announce)),
    [game, announce, t.announce],
  );

  useEffect(() => {
    if (game === null) {
      return;
    }
    if (paused) {
      game.pause();
    } else {
      game.resume();
    }
  }, [game, paused]);

  if (crash !== null) {
    throw crash.error;
  }

  const rewind = (): void => {
    setPaused(false);
    setGeneration((current) => current + 1);
  };

  return (
    <main aria-label={t.replay.label} className="game">
      <canvas ref={canvasRef} className="game-canvas">
        {t.game.canvas}
      </canvas>
      {unsupported ? (
        <div className="replay-controls">
          <p role="alert">{t.game.unsupported}</p>
          <Button variant="secondary" onClick={onBack}>
            {t.common.back}
          </Button>
        </div>
      ) : (
        game !== null && (
          <>
            <GameHud game={game} maxLives={DIFFICULTIES[replay.difficulty].lives} />
            <ReplayControls
              game={game}
              paused={paused}
              speed={speed}
              onPause={setPaused}
              onSpeed={setSpeed}
              onRewind={rewind}
              onBack={onBack}
            />
          </>
        )
      )}
    </main>
  );
}

interface ReplayControlsProps {
  readonly game: Game;
  readonly paused: boolean;
  readonly speed: ReplaySpeed;
  readonly onPause: (paused: boolean) => void;
  readonly onSpeed: (speed: ReplaySpeed) => void;
  readonly onRewind: () => void;
  readonly onBack: () => void;
}

/**
 * The controls under the replay: native buttons and radios, in the order of the page, so a
 * keyboard reaches each with Tab and a screen reader names each. The end of the replay is said in
 * words; the announcer has already said how the run ended.
 */
function ReplayControls({
  game,
  paused,
  speed,
  onPause,
  onSpeed,
  onRewind,
  onBack,
}: ReplayControlsProps): JSX.Element {
  const { t } = useI18n();
  const over = useGameHud(game, (hud) => isRunOver(hud.status));

  return (
    <section aria-label={t.replay.controls} className="replay-controls">
      {over && <p>{t.replay.over}</p>}
      <Inline gap="md" justify="center" align="end">
        <Button
          onClick={() => {
            onPause(!paused);
          }}
        >
          {paused ? t.replay.play : t.replay.pause}
        </Button>
        <Button variant="secondary" onClick={onRewind}>
          {t.replay.rewind}
        </Button>
        <RadioGroup
          label={t.replay.speed}
          name="replay-speed"
          options={REPLAY_SPEEDS.map((option) => ({
            value: String(option),
            label: t.replay.speedOption(option),
          }))}
          value={String(speed)}
          onValueChange={(value) => {
            const chosen = REPLAY_SPEEDS.find((option) => String(option) === value);
            if (chosen !== undefined) {
              onSpeed(chosen);
            }
          }}
        />
        <Button variant="secondary" onClick={onBack}>
          {t.common.back}
        </Button>
      </Inline>
    </section>
  );
}
