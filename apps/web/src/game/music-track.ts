import aac from '../../assets-src/music/abstraction-music-loop-bundle/music-pixel-war-1.m4a';
import ogg from '../../assets-src/music/abstraction-music-loop-bundle/music-pixel-war-1.ogg';
import type { MusicSource } from './music';

/**
 * The track every run streams (#161, ADR-0018): "Pixel War 1" from the chiptune pack of the Music
 * Loop Bundle by Abstraction (Tallbeard Studios, CC0), which the owner picked on 2026-11-19. Each
 * file starts with `music-`, so the build counts it against the music budget and not against the
 * 1 MB of the images and sounds. The Ogg comes first: it loops without a gap. AAC is for the
 * browsers that cannot play Ogg.
 */
export const MUSIC_TRACK: readonly MusicSource[] = [
  { url: ogg, type: 'audio/ogg; codecs=vorbis' },
  { url: aac, type: 'audio/mp4; codecs="mp4a.40.2"' },
];
