// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

import {
  createMusicPlayer,
  documentVisibility,
  type MusicElement,
  type MusicSource,
  type PageVisibility,
} from './music';

const OGG: MusicSource = { url: '/music-loop.ogg', type: 'audio/ogg; codecs=vorbis' };
const MP3: MusicSource = { url: '/music-loop.mp3', type: 'audio/mpeg' };

/** An `<audio>` element that plays the types it is given. */
function fakeElement(playable: readonly string[] = [OGG.type, MP3.type]): MusicElement {
  return {
    src: '',
    loop: false,
    currentTime: 0,
    canPlayType: (type) => (playable.includes(type) ? 'maybe' : ''),
    play: () => Promise.resolve(),
    pause: () => undefined,
  };
}

/** A page whose visibility the test changes. */
function fakePage(hidden = false) {
  const listeners = new Set<(hidden: boolean) => void>();
  const visibility: PageVisibility = {
    get hidden() {
      return hidden;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  const show = (nowHidden: boolean): void => {
    hidden = nowHidden;
    for (const listener of listeners) {
      listener(nowHidden);
    }
  };
  return {
    visibility,
    hide: () => {
      show(true);
    },
    reveal: () => {
      show(false);
    },
  };
}

function setup(
  sources: readonly MusicSource[] = [OGG],
  element = fakeElement(),
  page = fakePage(),
) {
  const mixer = { streamMusic: vi.fn(), stopMusic: vi.fn() };
  const createElement = vi.fn(() => element);
  const music = createMusicPlayer(mixer, {
    sources,
    createElement,
    visibility: page.visibility,
  });
  return { mixer, createElement, music, element, page };
}

describe('createMusicPlayer', () => {
  it('makes no element and streams nothing while the game has no track', () => {
    const { mixer, createElement, music } = setup([]);

    music.follow('playing');
    music.follow('stopped');

    expect(createElement).not.toHaveBeenCalled();
    expect(mixer.streamMusic).not.toHaveBeenCalled();
  });

  it('downloads nothing before the run plays, then streams the first source the browser can play', () => {
    const { mixer, createElement, music, element } = setup([OGG, MP3], fakeElement([MP3.type]));

    music.follow('stopped');
    expect(createElement).not.toHaveBeenCalled();

    music.follow('playing');

    expect(createElement).toHaveBeenCalledOnce();
    expect(element.src).toBe(MP3.url);
    expect(mixer.streamMusic.mock.calls).toEqual([[element]]);
  });

  it('streams once while the run plays on, between the levels too', () => {
    const { mixer, music } = setup();

    music.follow('playing');
    music.follow('playing');

    expect(mixer.streamMusic).toHaveBeenCalledOnce();
    expect(mixer.stopMusic).not.toHaveBeenCalled();
  });

  it('keeps its place through a pause, and starts over once the run is over', () => {
    const { mixer, createElement, music, element } = setup();
    music.follow('playing');
    element.currentTime = 12;

    music.follow('paused');
    expect(mixer.stopMusic).toHaveBeenCalledOnce();
    expect(element.currentTime).toBe(12);

    music.follow('playing');
    expect(mixer.streamMusic.mock.calls).toEqual([[element], [element]]);

    music.follow('stopped');
    expect(mixer.stopMusic).toHaveBeenCalledTimes(2);
    expect(element.currentTime).toBe(0);
    expect(createElement).toHaveBeenCalledOnce();
  });

  it('falls silent while the page is hidden, when the loop runs no frames, and plays on when it is back', () => {
    const { mixer, music, page } = setup();
    music.follow('playing');

    page.hide();
    expect(mixer.stopMusic).toHaveBeenCalledOnce();

    page.reveal();
    expect(mixer.streamMusic).toHaveBeenCalledTimes(2);

    music.follow('paused');
    page.hide();
    page.reveal();
    expect(mixer.streamMusic).toHaveBeenCalledTimes(2);
  });

  it('waits for a page that starts hidden', () => {
    const page = fakePage(true);
    const { mixer, music } = setup([OGG], fakeElement(), page);

    music.follow('playing');
    expect(mixer.streamMusic).not.toHaveBeenCalled();

    page.reveal();
    expect(mixer.streamMusic).toHaveBeenCalledOnce();
  });

  it('streams nothing when the browser can play none of the sources', () => {
    const { mixer, music, element } = setup([OGG], fakeElement([]));

    music.follow('playing');

    expect(element.src).toBe('');
    expect(mixer.streamMusic).not.toHaveBeenCalled();
  });
});

describe('documentVisibility', () => {
  it("reports the document's visibility and each change of it, until unsubscribed", () => {
    const target = new EventTarget();
    const document = Object.assign(target, { hidden: false });
    const visibility = documentVisibility(document);
    const listener = vi.fn();

    const unsubscribe = visibility.subscribe(listener);
    document.hidden = true;
    target.dispatchEvent(new Event('visibilitychange'));
    expect(visibility.hidden).toBe(true);
    unsubscribe();
    document.hidden = false;
    target.dispatchEvent(new Event('visibilitychange'));

    expect(listener.mock.calls).toEqual([[true]]);
  });
});
