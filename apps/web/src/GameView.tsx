import {
  type ActionInput,
  applyCanvasFit,
  type AudioMixer,
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
  type GameSound,
  WORLD,
} from '@buzzkill/game';
import { type JSX, useEffect, useRef, useState } from 'react';

import { createGameDrawer } from './game/draw-game';
import { GAME_VERSION, seedForRun } from './game/run-options';
import type { GameSprites } from './game/sprites';
import { GameHud } from './GameHud';
import type { StartChoice } from './StartScreen';

interface GameViewProps {
  readonly choice: StartChoice;
  readonly sprites: GameSprites<ImageBitmap>;
  readonly audio: AudioMixer<GameSound>;
  readonly onExit: () => void;
}

/**
 * The canvas and one run of the game on it. Everything the run needs is created here and passed
 * to `createGame`: the input with its keyboard and gamepad sources, the frame host, the Canvas 2D
 * renderer with the game's drawing code, and the audio. The shell then talks to the run only
 * through the `Game` object. "Play again" starts a new run on the same canvas.
 */
export function GameView({ choice, sprites, audio, onExit }: GameViewProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [game, setGame] = useState<Game | null>(null);
  const [unsupported, setUnsupported] = useState(false);
  const [run, setRun] = useState(0);

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
      settings: { heroId: choice.heroId, mode: choice.mode },
      seed: seedForRun(window.location.search),
      gameVersion: GAME_VERSION,
      input: polledInput,
      host: createBrowserHost(),
      renderer: createGameDrawer(renderer, sprites),
      audio,
    });
    setGame(created);
    created.start();

    return () => {
      created.dispose();
      keyboard.dispose();
      gamepad.dispose();
      window.removeEventListener('resize', fit);
    };
  }, [choice, sprites, audio, run]);

  return (
    <>
      <canvas ref={canvasRef} className="game-canvas">
        Buzzkill game screen
      </canvas>
      {unsupported ? (
        <p role="alert">
          Your browser does not support the canvas element, so the game cannot run.
        </p>
      ) : (
        game !== null && (
          <GameHud
            game={game}
            onPlayAgain={() => {
              setRun((count) => count + 1);
            }}
            onExit={onExit}
          />
        )
      )}
    </>
  );
}
