// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { MUSIC_TRACK } from './music-track';

describe('MUSIC_TRACK', () => {
  it('streams the Ogg first, and AAC where the browser cannot play Ogg (#161)', () => {
    expect(MUSIC_TRACK.map(({ type }) => type)).toEqual([
      'audio/ogg; codecs=vorbis',
      'audio/mp4; codecs="mp4a.40.2"',
    ]);
  });

  it('names each file as music, so the build counts it against the music budget (ADR-0018)', () => {
    const names = MUSIC_TRACK.map(({ url }) => url.split('/').pop());

    expect(names).toEqual(['music-pixel-war-1.ogg', 'music-pixel-war-1.m4a']);
  });
});
