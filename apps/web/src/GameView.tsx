import {
  type ActionInput,
  applyCanvasFit,
  computeCanvasFit,
  createActionInput,
  createCanvas2DRenderer,
  type GameLoopHost,
  type KeyBindings,
} from '@buzzkill/engine';
import {
  createBrowserHost,
  createGamepadSource,
  createKeyboardSource,
  type KeyboardSource,
} from '@buzzkill/engine/browser';
import {
  createGame,
  DEFAULT_GAMEPAD_BINDINGS,
  type Game,
  GAME_ACTIONS,
  type GameAction,
  WORLD,
} from '@buzzkill/game';
import { type JSX, useEffect, useRef, useState } from 'react';

import { useAnnounce } from './announcer';
import { announceRun } from './game/announce-run';
import { createGameDrawer } from './game/draw-game';
import { pacedHost } from './game/paced-host';
import { GAME_VERSION } from './game/run-options';
import { GameHud } from './GameHud';
import { useI18n } from './i18n/i18n';
import { connectGame, type GameEvent } from './state/bridge';
import type { GameAssets, Run } from './state/machine';

interface GameViewProps {
  readonly run: Run;
  readonly assets: GameAssets;
  /** The machine's word: `true` holds the game, `false` lets it go on. */
  readonly paused: boolean;
  /** The player's keys, from the settings; a change applies to the run on screen. */
  readonly keyBindings: KeyBindings<GameAction>;
  /** Where the game's own reports go: the pause, the resume and the end of the run. */
  readonly onEvent: (event: GameEvent) => void;
}

/**
 * The canvas and one run of the game on it. The effect that the run keys creates everything the
 * run needs and passes it to `createGame`: the input with its keyboard and gamepad sources, the
 * frame host, the Canvas 2D renderer with the game's drawing code, and the shared mixer, whose
 * volumes the settings set. The machine then drives the game through `paused`, and the game
 * drives the machine through the bridge, so each side learns of the other's pause without a
 * loop: `pause` and `resume` do nothing when the game is there already.
 *
 * An error in a frame runs outside React, where it would stop the loop without a word; it is kept
 * and thrown in the next render, so the error boundary around the run sees it (#113). A run that
 * fails to start releases what it had taken before the error goes on.
 */
export function GameView({
  run,
  assets,
  paused,
  keyBindings,
  onEvent,
}: GameViewProps): JSX.Element {
  const { t } = useI18n();
  const announce = useAnnounce();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [game, setGame] = useState<Game | null>(null);
  const [unsupported, setUnsupported] = useState(false);
  // The keys are read when a run starts and pushed to its keyboard source when they change;
  // they are not a dependency of the run, so new keys never restart it.
  const bindingsRef = useRef(keyBindings);
  const keyboardRef = useRef<KeyboardSource<GameAction> | null>(null);
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
      const renderer = createCanvas2DRenderer(context, WORLD);
      const fit = (): void => {
        const result = computeCanvasFit({
          logical: WORLD,
          viewport: { width: window.innerWidth, height: window.innerHeight },
          devicePixelRatio: window.devicePixelRatio,
        });
        applyCanvasFit(canvas, result);
        renderer.setScale(result.scale);
      };
      fit();
      window.addEventListener('resize', fit);
      cleanups.push(() => {
        window.removeEventListener('resize', fit);
      });

      const input = createActionInput(GAME_ACTIONS);
      const keyboard = createKeyboardSource(input, bindingsRef.current);
      keyboardRef.current = keyboard;
      cleanups.push(() => {
        keyboard.dispose();
        keyboardRef.current = null;
      });
      const gamepad = createGamepadSource(input, { bindings: DEFAULT_GAMEPAD_BINDINGS });
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
      const browserHost = pacedHost(createBrowserHost(), run.speed);
      const host: GameLoopHost = {
        ...browserHost,
        requestFrame: (callback) =>
          browserHost.requestFrame((timeMs) => {
            try {
              callback(timeMs);
            } catch (error) {
              setCrash({ error });
            }
          }),
      };

      const created = createGame({
        settings: { heroId: run.heroId, mode: run.mode },
        seed: run.seed,
        gameVersion: GAME_VERSION,
        input: polledInput,
        host,
        renderer: createGameDrawer(renderer, assets.sprites),
        audio: assets.audio,
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
  }, [run, assets]);

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

  if (crash !== null) {
    throw crash.error;
  }

  return (
    <main aria-label={t.game.label}>
      <canvas ref={canvasRef} className="game-canvas">
        {t.game.canvas}
      </canvas>
      {unsupported ? (
        <p role="alert">{t.game.unsupported}</p>
      ) : (
        game !== null && <GameHud game={game} />
      )}
    </main>
  );
}
