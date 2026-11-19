import type { AudioMixer, MediaElementLike } from '@buzzkill/engine';

/** One encoding of the track: its URL and the MIME type a browser checks before it downloads. */
export interface MusicSource {
  readonly url: string;
  readonly type: string;
}

/** The part of an `<audio>` element the music uses. */
export interface MusicElement extends MediaElementLike {
  src: string;
  currentTime: number;
  canPlayType(type: string): string;
}

/** Whether the page is hidden, and its changes. */
export interface PageVisibility {
  readonly hidden: boolean;
  /** Calls `listener` on each change; returns the unsubscribe. */
  subscribe(listener: (hidden: boolean) => void): () => void;
}

/**
 * What the run asks of the music: to play, to hold its place in a pause, or to stop and start
 * over with the next run.
 */
export type MusicStatus = 'playing' | 'paused' | 'stopped';

export interface MusicPlayer {
  /** Follows the run; the same status twice is a no-op. */
  follow(status: MusicStatus): void;
}

export interface MusicPlayerOptions {
  /** The encodings of the track, best first; none while the game has no track. */
  readonly sources: readonly MusicSource[];
  /** A new `<audio>` element, made at the first play so the menu downloads nothing. */
  readonly createElement: () => MusicElement;
  readonly visibility: PageVisibility;
}

/**
 * The music of a run (#161, ADR-0018). It streams through the mixer's music group, so the volume
 * setting and the ducking of the explosions apply. It plays while the run plays and between the
 * levels, holds its place in a pause, and starts over after the run. It falls silent while the
 * page is hidden too: the loop runs no frames then, and the run waits without a pause.
 */
export function createMusicPlayer(
  mixer: Pick<AudioMixer<string>, 'streamMusic' | 'stopMusic'>,
  { sources, createElement, visibility }: MusicPlayerOptions,
): MusicPlayer {
  if (sources.length === 0) {
    return { follow: () => undefined };
  }
  let status: MusicStatus = 'stopped';
  let hidden = visibility.hidden;
  let sounding = false;
  /** The element once made, or null after a browser that plays none of the sources said so. */
  let element: MusicElement | null | undefined;

  const ready = (): MusicElement | null => {
    if (element === undefined) {
      const made = createElement();
      const source = sources.find(({ type }) => made.canPlayType(type) !== '');
      if (source !== undefined) {
        made.src = source.url;
      }
      element = source === undefined ? null : made;
    }
    return element;
  };

  const update = (): void => {
    const wanted = status === 'playing' && !hidden;
    if (wanted && !sounding) {
      const playable = ready();
      if (playable !== null) {
        // A mixer still locked lets this be; the next play, after a resume, tries again.
        mixer.streamMusic(playable);
        sounding = true;
      }
    } else if (!wanted && sounding) {
      mixer.stopMusic();
      sounding = false;
    }
    if (status === 'stopped' && element) {
      element.currentTime = 0;
    }
  };

  visibility.subscribe((nowHidden) => {
    hidden = nowHidden;
    update();
  });

  return {
    follow(next) {
      if (next === status) {
        return;
      }
      status = next;
      update();
    },
  };
}

/** The visibility of a document, as the music follows it. */
export function documentVisibility(
  document: Pick<Document, 'hidden' | 'addEventListener' | 'removeEventListener'>,
): PageVisibility {
  return {
    get hidden() {
      return document.hidden;
    },
    subscribe(listener) {
      const onChange = (): void => {
        listener(document.hidden);
      };
      document.addEventListener('visibilitychange', onChange);
      return () => {
        document.removeEventListener('visibilitychange', onChange);
      };
    },
  };
}
