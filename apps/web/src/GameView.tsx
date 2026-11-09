import {
  type ActionInput,
  applyCanvasFit,
  computeCanvasFit,
  createActionInput,
  createCanvas2DRenderer,
} from '@buzzkill/engine';
import {
  createBrowserHost,
  createGamepadSource,
  createKeyboardSource,
} from '@buzzkill/engine/browser';
import {
  createGame,
  DEFAULT_GAMEPAD_BINDINGS,
  DEFAULT_KEY_BINDINGS,
  type Game,
  GAME_ACTIONS,
  type GameAction,
  WORLD,
} from '@buzzkill/game';
import { type JSX, useEffect, useRef, useState } from 'react';

import { createGameDrawer } from './game/draw-game';
import { GAME_VERSION } from './game/run-options';
import { GameHud } from './GameHud';
import { connectGame, type GameEvent } from './state/bridge';
import type { GameAssets, Run } from './state/machine';

interface GameViewProps {
  readonly run: Run;
  readonly assets: GameAssets;
  /** The machine's word: `true` holds the game, `false` lets it go on. */
  readonly paused: boolean;
  /** Where the game's own reports go: the pause, the resume and the end of the run. */
  readonly onEvent: (event: GameEvent) => void;
}

/**
 * The canvas and one run of the game on it. The effect that the run keys creates everything the
 * run needs and passes it to `createGame`: the input with its keyboard and gamepad sources, the
 * frame host, the Canvas 2D renderer with the game's drawing code, and the shared mixer, whose
 * volumes the settings set. The machine then drives the game through `paused`, and the game drives the
 * machine through the bridge, so each side learns of the other's pause without a loop: `pause`
 * and `resume` do nothing when the game is there already.
 */
export function GameView({ run, assets, paused, onEvent }: GameViewProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [game, setGame] = useState<Game | null>(null);
  const [unsupported, setUnsupported] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d') ?? null;
    if (canvas === null || context === null) {
      setUnsupported(true);
      return;
    }

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

    const input = createActionInput(GAME_ACTIONS);
    const keyboard = createKeyboardSource(input, DEFAULT_KEY_BINDINGS);
    const gamepad = createGamepadSource(input, { bindings: DEFAULT_GAMEPAD_BINDINGS });
    // Gamepads send no events: poll them right before the game samples each tick.
    const polledInput: ActionInput<GameAction> = {
      ...input,
      sample() {
        gamepad.poll();
        return input.sample();
      },
    };

    const created = createGame({
      settings: { heroId: run.heroId, mode: run.mode },
      seed: run.seed,
      gameVersion: GAME_VERSION,
      input: polledInput,
      host: createBrowserHost(),
      renderer: createGameDrawer(renderer, assets.sprites),
      audio: assets.audio,
    });
    setGame(created);
    created.start();

    return () => {
      created.dispose();
      keyboard.dispose();
      gamepad.dispose();
      window.removeEventListener('resize', fit);
    };
  }, [run, assets]);

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

  return (
    <main aria-label="Game">
      <canvas ref={canvasRef} className="game-canvas">
        Buzzkill game screen
      </canvas>
      {unsupported ? (
        <p role="alert">
          Your browser does not support the canvas element, so the game cannot run.
        </p>
      ) : (
        game !== null && <GameHud game={game} />
      )}
    </main>
  );
}
