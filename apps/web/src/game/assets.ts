import type { AssetManifest } from '@buzzkill/engine';
import type { GameSound } from '@buzzkill/game';

// The 2023 files, downloaded for the team project from a source nobody recorded, so their license
// is unknown; stage 6 replaces them (#132, docs/assets.md). The heroes, the background and the
// first day enemy were drawn by other team members or are over 1 MB, so they are placeholders.
import shotSound from '../assets/bullet-sound.wav';
import enemyBat2 from '../assets/enemy_bat_2.png';
import enemyBat3 from '../assets/enemy_bat_3.png';
import enemyRaven from '../assets/enemy_raven.png';
import enemy2 from '../assets/enemy-2.png';
import enemy3 from '../assets/enemy-3.png';
import fireExplosion from '../assets/fireExplosion.png';
import hitSound from '../assets/pain-sound.wav';
import projectile from '../assets/projectile.png';
import explosionSound from '../assets/smoke-bomb.wav';
import smokeExplosion from '../assets/smokeExplosion.png';

/** Enemy sprite sheets without art in the repository yet; they are drawn as placeholders. */
export const MISSING_SHEETS: readonly string[] = ['enemy-day-1'];

/**
 * Everything the game loads before the first frame. Enemy sheets are keyed by the sheet names of
 * the game configuration. Sounds are optional: without Web Audio the game runs silently instead
 * of failing to load.
 */
export const GAME_ASSETS = {
  'enemy-2': { kind: 'image', url: enemy2 },
  'enemy-3': { kind: 'image', url: enemy3 },
  enemy_bat_2: { kind: 'image', url: enemyBat2 },
  enemy_bat_3: { kind: 'image', url: enemyBat3 },
  enemy_raven: { kind: 'image', url: enemyRaven },
  projectile: { kind: 'image', url: projectile },
  smokeExplosion: { kind: 'image', url: smokeExplosion },
  fireExplosion: { kind: 'image', url: fireExplosion },
  shot: { kind: 'audio', url: shotSound, optional: true },
  explosion: { kind: 'audio', url: explosionSound, optional: true },
  hit: { kind: 'audio', url: hitSound, optional: true },
} as const satisfies AssetManifest & Record<GameSound, unknown>;

export type GameAssetManifest = typeof GAME_ASSETS;
