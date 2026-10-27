/**
 * Settings the shell passes into the legacy `Game`. They replace the globals the 2023 code
 * imported from the old settings modal, so the engine no longer depends on any UI module.
 */
export interface GameSettings {
  /** Volume of every sound effect, from 0 (muted) to 1. Read on every update, so it can change live. */
  volume: number;
  /** Day spawns insects, night spawns bats, ravens and ghosts. Fixed for the duration of a game. */
  mode: 'day' | 'night';
}
