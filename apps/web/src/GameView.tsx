import { type ActionInput, createActionInput, createRng, type KeyBindings } from '@buzzkill/engine';
import {
  createBrowserHost,
  createGamepadSource,
  createKeyboardSource,
  type KeyboardSource,
} from '@buzzkill/engine/browser';
import {
  type AchievementId,
  type AchievementProgress,
  createGame,
  DEFAULT_GAMEPAD_BINDINGS,
  DIFFICULTIES,
  followAchievements,
  type Game,
  GAME_ACTIONS,
  type GameAction,
  WORLD,
} from '@buzzkill/game';
import { type JSX, useEffect, useRef, useState } from 'react';

import { useAnnounce } from './announcer';
import { announceRun } from './game/announce-run';
import { createGameDrawer } from './game/draw-game';
import { createGameAudio, SOUND_SEED } from './game/game-audio';
import { browserGamepads, canRumble, createHaptics, findVibrator } from './game/haptics';
import { pacedHost } from './game/paced-host';
import { attachRunCanvas, catchingHost } from './game/run-canvas';
import { GAME_VERSION } from './game/run-options';
import { GameHud } from './GameHud';
import { useI18n } from './i18n/i18n';
import { connectGame, type GameEvent } from './state/bridge';
import type { GameAssets, Run } from './state/machine';
import { TouchControls } from './TouchControls';

interface GameViewProps {
  readonly run: Run;
  readonly assets: GameAssets;
  /** The machine's word: `true` holds the game, `false` lets it go on. */
  readonly paused: boolean;
  /** Hides the view while the replay of the finished run is on screen over it (#219). */
  readonly hidden?: boolean;
  /** The player's keys, from the settings; a change applies to the run on screen. */
  readonly keyBindings: KeyBindings<GameAction>;
  /**
   * Whether motion is reduced, by the setting or the system (#114): the city then scrolls slower.
   * A change applies to the run on screen.
   */
  readonly reducedMotion: boolean;
  /** The particles setting (#156); a change applies to the run on screen. */
  readonly particles: boolean;
  /** The screen shake setting (#157); a change applies to the run on screen. */
  readonly screenShake: boolean;
  /** The hit flash setting (#159); a change applies to the run on screen. */
  readonly hitFlash: boolean;
  /** The squash and stretch setting (#159); a change applies to the run on screen. */
  readonly squashStretch: boolean;
  /** The hit-stop setting (#158); a change applies to the run on screen. */
  readonly hitStop: boolean;
  /** The vibration setting (#162); a change applies to the run on screen. */
  readonly vibration: boolean;
  /** The progress of the achievements before the run (#163). */
  readonly achievements: AchievementProgress;
  /** Called with the new progress after each event that moved it, and what it earned. */
  readonly onAchievements: (
    progress: AchievementProgress,
    earned: readonly AchievementId[],
  ) => void;
  /**
   * The machine shows the screen between levels. The game holds itself on a cleared level; when
   * this turns false again, the next level starts (ADR-0017).
   */
  readonly betweenLevels: boolean;
  /** Where the game's own reports go: the pause, the resume and the end of the run. */
  readonly onEvent: (event: GameEvent) => void;
}

/**
 * The canvas and one run of the game on it. The effect that the run keys creates everything the
 * run needs and passes it to `createGame`: the input with its keyboard and gamepad sources, the
 * frame host, the Canvas 2D renderer with the game's drawing code, and the shared mixer, whose
 * volumes the settings set. The touch controls attach to the same input once it exists (#153).
 * The machine then drives the game through `paused`, and the game drives the machine through the
 * bridge, so each side learns of the other's pause without a loop: `pause` and `resume` do
 * nothing when the game is there already.
 *
 * An error in a frame runs outside React, where it would stop the loop without a word; it is kept
 * and thrown in the next render, so the error boundary around the run sees it (#113). A run that
 * fails to start releases what it had taken before the error goes on.
 */
export function GameView({
  run,
  assets,
  paused,
  hidden = false,
  keyBindings,
  reducedMotion,
  particles,
  screenShake,
  hitFlash,
  squashStretch,
  hitStop,
  vibration,
  achievements,
  onAchievements,
  betweenLevels,
  onEvent,
}: GameViewProps): JSX.Element {
  const { t } = useI18n();
  const announce = useAnnounce();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [game, setGame] = useState<Game | null>(null);
  const [input, setInput] = useState<ActionInput<GameAction> | null>(null);
  const [suggestLandscape, setSuggestLandscape] = useState(false);
  const [unsupported, setUnsupported] = useState(false);
  // The keys are read when a run starts and pushed to its keyboard source when they change;
  // they are not a dependency of the run, so new keys never restart it.
  const bindingsRef = useRef(keyBindings);
  const keyboardRef = useRef<KeyboardSource<GameAction> | null>(null);
  // Read by the drawer every frame, so they are not dependencies of the run either.
  const reducedMotionRef = useRef(reducedMotion);
  const particlesRef = useRef(particles);
  const screenShakeRef = useRef(screenShake);
  const hitFlashRef = useRef(hitFlash);
  const squashStretchRef = useRef(squashStretch);
  const hitStopRef = useRef(hitStop);
  const vibrationRef = useRef(vibration);
  const onEventRef = useRef(onEvent);
  const achievementsRef = useRef(achievements);
  const onAchievementsRef = useRef(onAchievements);
  const [crash, setCrash] = useState<{ readonly error: unknown } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d') ?? null;
    if (canvas === null || context === null) {
      setUnsupported(true);
      return;
    }

    // What the run holds, released in reverse order on unmount, or at once when it fails to start.
    const cleanups: (() => void)[] = [];
    const release = (): void => {
      for (const cleanup of cleanups.splice(0).reverse()) {
        cleanup();
      }
    };

    try {
      const { renderer, dispose: detach } = attachRunCanvas(canvas, context, setSuggestLandscape);
      cleanups.push(detach);

      const input = createActionInput(GAME_ACTIONS);
      const keyboard = createKeyboardSource(input, bindingsRef.current);
      keyboardRef.current = keyboard;
      cleanups.push(() => {
        keyboard.dispose();
        keyboardRef.current = null;
      });
      const gamepad = createGamepadSource(input, {
        bindings: DEFAULT_GAMEPAD_BINDINGS,
        // A gamepad gone in the middle of a run pauses it, and the pause says why (#154).
        onDisconnect: () => {
          onEventRef.current({ type: 'gamepadLost' });
        },
      });
      cleanups.push(() => {
        gamepad.dispose();
      });
      // Gamepads send no events: poll them right before the game samples each tick.
      const polledInput: ActionInput<GameAction> = {
        ...input,
        sample() {
          gamepad.poll();
          return input.sample();
        },
      };

      // The run's pace (#114): its own clock, the same ticks.
      const host = catchingHost(pacedHost(createBrowserHost(), run.speed), (error) => {
        setCrash({ error });
      });

      // A device that can neither vibrate nor rumble a gamepad gets no haptics at all (#162, #154).
      const vibrator = findVibrator(globalThis.navigator);
      const feels = vibrator !== null || canRumble(globalThis);
      const soundRng = createRng((run.seed ^ SOUND_SEED) >>> 0);
      const created = createGame({
        settings: {
          heroId: run.heroId,
          mode: run.mode,
          difficulty: run.difficulty,
          daily: run.daily,
        },
        seed: run.seed,
        gameVersion: GAME_VERSION,
        input: polledInput,
        host,
        renderer: createGameDrawer(renderer, assets.sprites, {
          reducedMotion: () => reducedMotionRef.current,
          particles: () => particlesRef.current,
          screenShake: () => screenShakeRef.current,
          hitFlash: () => hitFlashRef.current,
          squashStretch: () => squashStretchRef.current,
          hitStop: () => hitStopRef.current,
          seed: run.seed,
        }),
        // The sounds' variety draws on numbers of its own, apart from the simulation's (#161).
        // The run counts toward the achievements from the progress at its start (#163).
        followers: [
          (events) => {
            followAchievements(events, {
              mode: run.mode,
              progress: achievementsRef.current,
              onChange: (progress, earned) => {
                onAchievementsRef.current(progress, earned);
              },
            });
          },
        ],
        audio: createGameAudio(assets.audio, {
          random: () => soundRng.nextFloat(),
          width: WORLD.width,
        }),
        ...(feels
          ? {
              haptics: createHaptics({
                enabled: () => vibrationRef.current,
                vibrator,
                gamepads: browserGamepads,
              }),
            }
          : {}),
      });
      cleanups.push(() => {
        created.dispose();
      });
      setGame(created);
      setInput(input);
      created.start();
    } catch (error) {
      release();
      throw error;
    }

    return release;
  }, [run, assets]);

  useEffect(() => {
    reducedMotionRef.current = reducedMotion;
  }, [reducedMotion]);

  useEffect(() => {
    particlesRef.current = particles;
  }, [particles]);

  useEffect(() => {
    screenShakeRef.current = screenShake;
  }, [screenShake]);

  useEffect(() => {
    hitFlashRef.current = hitFlash;
    squashStretchRef.current = squashStretch;
    hitStopRef.current = hitStop;
    vibrationRef.current = vibration;
  }, [hitFlash, squashStretch, hitStop, vibration]);

  useEffect(() => {
    if (bindingsRef.current === keyBindings) {
      return;
    }
    bindingsRef.current = keyBindings;
    keyboardRef.current?.setBindings(keyBindings);
  }, [keyBindings]);

  // Screen readers hear the start of the run, each life lost and its end (#114).
  useEffect(
    () => (game === null ? undefined : announceRun(game, announce, t.announce)),
    [game, announce, t.announce],
  );

  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    achievementsRef.current = achievements;
    onAchievementsRef.current = onAchievements;
  }, [achievements, onAchievements]);

  // The bridge: what the game reports becomes events of the machine.
  useEffect(() => (game === null ? undefined : connectGame(game, onEvent)), [game, onEvent]);

  // The machine's command. The game's own pause arrives here as `paused` too, and is a no-op.
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

  // The player went on from the screen between levels. While no level is cleared, a no-op.
  useEffect(() => {
    if (game !== null && !betweenLevels) {
      game.nextLevel();
    }
  }, [game, betweenLevels]);

  if (crash !== null) {
    throw crash.error;
  }

  return (
    // `game` is fixed over the whole window, so on a touch screen every finger lands in it, where
    // the browser's own gestures are off (#153).
    <main aria-label={t.game.label} className="game" hidden={hidden}>
      <canvas ref={canvasRef} className="game-canvas">
        {t.game.canvas}
      </canvas>
      {unsupported ? (
        <p role="alert">{t.game.unsupported}</p>
      ) : (
        <>
          {game !== null && <GameHud game={game} maxLives={DIFFICULTIES[run.difficulty].lives} />}
          <TouchControls
            input={input}
            onPause={() => {
              game?.pause();
            }}
            suggestLandscape={suggestLandscape}
          />
        </>
      )}
    </main>
  );
}
