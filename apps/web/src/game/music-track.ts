import type { MusicSource } from './music';

/**
 * The track every run streams (#161, ADR-0018): a loop the owner picks from the Music Loop
 * Bundle of Abstraction (Tallbeard Studios, CC0). It goes into `assets-src/music/` with a name
 * that starts with `music-`, so the build counts it against the music budget and not against the
 * 1 MB of the images and sounds. Each encoding is a source here, best first; the game is silent
 * until the first one is in.
 */
export const MUSIC_TRACK: readonly MusicSource[] = [];
