/**
 * Hand-written public types of the legacy engine. The React shell compiles against this file
 * (the `types` condition of the `./legacy` export) instead of the 2023 sources, which predate the
 * strict compiler options of the workspace. Removed together with the folder in #42.
 */
import type { GameSettings } from './settings';

export type { GameSettings };

/** Hero identifiers the legacy `Game` understands; anything but `female` draws the male hero. */
export type LegacyHero = 'male' | 'female';

export declare class Game {
  constructor(width: number, height: number, chosedHero: LegacyHero, settings: GameSettings);
  /** True once the player has won or lost; the loop may keep drawing the final screen. */
  gameOver: boolean;
  score: number;
  lives: number;
  settings: GameSettings;
  update(deltaTime: number): void;
  draw(context: CanvasRenderingContext2D): void;
}
