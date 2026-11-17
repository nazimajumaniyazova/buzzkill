import { describe, expect, it, vi } from 'vitest';

import {
  type AudioBufferSourceLike,
  type AudioContextLike,
  type AudioNodeLike,
  type AutomatedParamLike,
  createAudioMixer,
  type GainNodeLike,
  type MediaElementLike,
  type StereoPannerLike,
} from './mixer';

type Sound = 'shot' | 'hit' | 'theme';

interface FakeSource extends AudioBufferSourceLike<string> {
  readonly target: AudioNodeLike | null;
  readonly started: boolean;
  readonly stopped: boolean;
}

/**
 * A context that starts suspended and records the nodes it creates; with `panner: false`, it has
 * no stereo panner, as some older browsers.
 */
function createFakeContext(options: { refuseResume?: boolean; panner?: boolean } = {}) {
  const destination: AudioNodeLike = { connect: () => undefined };
  const gains: (GainNodeLike & {
    readonly gain: AutomatedParamLike & { readonly schedule: readonly ScheduledChange[] };
    target: AudioNodeLike | null;
  })[] = [];
  const sources: FakeSource[] = [];
  const panners: (StereoPannerLike & { target: AudioNodeLike | null })[] = [];
  /** Each media element's source, made once per element as the browser allows. */
  const media = new Map<MediaElementLike, { target: AudioNodeLike | null }>();
  let state = 'suspended';
  const clock = { now: 0 };
  const context: AudioContextLike<string> = {
    get state() {
      return state;
    },
    get currentTime() {
      return clock.now;
    },
    destination,
    createGain() {
      const schedule: ScheduledChange[] = [];
      const gain = {
        gain: {
          value: 1,
          schedule,
          cancelScheduledValues(time: number) {
            schedule.push(['cancel', time]);
          },
          setValueAtTime(value: number, time: number) {
            schedule.push(['set', value, time]);
          },
          linearRampToValueAtTime(value: number, time: number) {
            schedule.push(['ramp', value, time]);
          },
        },
        target: null as AudioNodeLike | null,
        connect(node: AudioNodeLike) {
          gain.target = node;
        },
      };
      gains.push(gain);
      return gain;
    },
    createBufferSource() {
      const source = {
        buffer: null as string | null,
        loop: false,
        playbackRate: { value: 1 },
        target: null as AudioNodeLike | null,
        started: false,
        stopped: false,
        connect(node: AudioNodeLike) {
          source.target = node;
        },
        start() {
          source.started = true;
        },
        stop() {
          source.stopped = true;
        },
      };
      sources.push(source);
      return source;
    },
    createMediaElementSource(element: MediaElementLike) {
      if (media.has(element)) {
        throw new Error('InvalidStateError: the element has a source already');
      }
      const source = {
        target: null as AudioNodeLike | null,
        connect(node: AudioNodeLike) {
          source.target = node;
        },
      };
      media.set(element, source);
      return source;
    },
    ...(options.panner === false
      ? {}
      : {
          createStereoPanner() {
            const panner = {
              pan: { value: 0 },
              target: null as AudioNodeLike | null,
              connect(node: AudioNodeLike) {
                panner.target = node;
              },
            };
            panners.push(panner);
            return panner;
          },
        }),
    resume() {
      if (options.refuseResume === true) {
        return Promise.reject(new Error('NotAllowedError'));
      }
      state = 'running';
      return Promise.resolve();
    },
    close() {
      state = 'closed';
      return Promise.resolve();
    },
  };
  return { context, destination, gains, sources, panners, media, clock };
}

const BUFFERS = { shot: 'shot-buffer', theme: 'theme-buffer' };

/** A change a gain was told to make: what, to which value, and when. */
type ScheduledChange = readonly [kind: string, value: number, time?: number];

/**
 * A media element that counts its starts and pauses; with `refuse`, its start is refused, as the
 * autoplay policy does. A plain function, since a mock would handle the promise it returns.
 */
function fakeElement(options: { refuse?: boolean } = {}) {
  let plays = 0;
  let pauses = 0;
  const element: MediaElementLike = {
    loop: false,
    play() {
      plays += 1;
      return options.refuse === true
        ? Promise.reject(new Error('NotAllowedError'))
        : Promise.resolve();
    },
    pause() {
      pauses += 1;
    },
  };
  return { element, plays: () => plays, pauses: () => pauses };
}

describe('createAudioMixer', () => {
  it('plays an effect at a rate and through a pan to the effects group (#161)', async () => {
    const fake = createFakeContext();
    const mixer = createAudioMixer<Sound, string>({ context: fake.context, buffers: BUFFERS });
    await mixer.unlock();

    mixer.play('shot', { rate: 1.05, pan: -0.5 });

    const [source] = fake.sources;
    const [panner] = fake.panners;
    expect(source?.playbackRate.value).toBe(1.05);
    expect(source?.target).toBe(panner);
    expect(panner?.pan.value).toBe(-0.5);
    expect(panner?.target).toBe(fake.gains[1]);
  });

  it('plays straight to the group at the natural rate without a pan, or without a panner', async () => {
    const plain = createFakeContext();
    const old = createFakeContext({ panner: false });
    const mixers = [plain, old].map((fake) =>
      createAudioMixer<Sound, string>({ context: fake.context, buffers: BUFFERS }),
    );
    await Promise.all(mixers.map((mixer) => mixer.unlock()));

    mixers[0]?.play('shot');
    mixers[1]?.play('shot', { pan: 0.7 });

    expect(plain.panners).toEqual([]);
    expect(plain.sources[0]?.playbackRate.value).toBe(1);
    expect(plain.sources[0]?.target).toBe(plain.gains[1]);
    expect(old.sources[0]?.target).toBe(old.gains[1]);
  });

  it('keeps a pan within the speakers', async () => {
    const fake = createFakeContext();
    const mixer = createAudioMixer<Sound, string>({ context: fake.context, buffers: BUFFERS });
    await mixer.unlock();

    mixer.play('shot', { pan: -3 });
    mixer.play('shot', { pan: 2 });

    expect(fake.panners.map((panner) => panner.pan.value)).toEqual([-1, 1]);
  });

  it('routes two volume groups to the speakers with their initial volumes', () => {
    const fake = createFakeContext();
    const mixer = createAudioMixer<Sound, string>({
      context: fake.context,
      buffers: BUFFERS,
      volumes: { effects: 0.4 },
    });

    expect(mixer.available).toBe(true);
    expect(fake.gains.map((gain) => [gain.gain.value, gain.target])).toEqual([
      [1, fake.destination],
      [0.4, fake.destination],
    ]);
    expect([mixer.getVolume('music'), mixer.getVolume('effects')]).toEqual([1, 0.4]);
  });

  it('drops sounds until a gesture unlocks audio, then plays effects from their buffers', async () => {
    const fake = createFakeContext();
    const mixer = createAudioMixer<Sound, string>({ context: fake.context, buffers: BUFFERS });

    mixer.play('shot');
    expect(fake.sources).toHaveLength(0);
    expect(mixer.unlocked).toBe(false);

    await mixer.unlock();
    mixer.play('shot');

    expect(mixer.unlocked).toBe(true);
    expect(fake.sources).toHaveLength(1);
    expect(fake.sources[0]).toMatchObject({
      buffer: 'shot-buffer',
      loop: false,
      started: true,
      target: fake.gains[1],
    });
  });

  it('skips sounds whose buffer was not loaded', async () => {
    const fake = createFakeContext();
    const mixer = createAudioMixer<Sound, string>({ context: fake.context, buffers: BUFFERS });
    await mixer.unlock();

    mixer.play('hit');

    expect(fake.sources).toHaveLength(0);
  });

  it('loops one music track at a time in the music group', async () => {
    const fake = createFakeContext();
    const mixer = createAudioMixer<Sound, string>({ context: fake.context, buffers: BUFFERS });
    await mixer.unlock();

    mixer.playMusic('theme');
    mixer.playMusic('theme');
    mixer.stopMusic();

    expect(fake.sources.map((source) => [source.loop, source.target, source.stopped])).toEqual([
      [true, fake.gains[0], true],
      [true, fake.gains[0], true],
    ]);
  });

  it('streams music from a media element through the music group, looped, one at a time', async () => {
    const fake = createFakeContext();
    const mixer = createAudioMixer<Sound, string>({ context: fake.context, buffers: BUFFERS });
    await mixer.unlock();
    const first = fakeElement();
    const second = fakeElement();

    mixer.streamMusic(first.element);
    mixer.streamMusic(second.element);
    mixer.streamMusic(first.element);
    mixer.stopMusic();

    expect(fake.media.get(first.element)?.target).toBe(fake.gains[0]);
    expect(fake.media.get(second.element)?.target).toBe(fake.gains[0]);
    expect([first.element.loop, first.plays(), first.pauses()]).toEqual([true, 2, 2]);
    expect([second.element.loop, second.plays(), second.pauses()]).toEqual([true, 1, 1]);
  });

  it('streams nothing while locked, and lets a refused start of the element be', async () => {
    const fake = createFakeContext();
    const mixer = createAudioMixer<Sound, string>({ context: fake.context, buffers: BUFFERS });
    const locked = fakeElement();
    mixer.streamMusic(locked.element);
    expect(locked.plays()).toBe(0);

    await mixer.unlock();
    const refused = fakeElement({ refuse: true });
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);
    try {
      mixer.streamMusic(refused.element);
      await new Promise((resolve) => setTimeout(resolve, 10));
    } finally {
      process.off('unhandledRejection', unhandled);
    }

    expect(refused.plays()).toBe(1);
    expect(unhandled).not.toHaveBeenCalled();
  });

  it('ducks the music: down quickly to a part of its volume, held, then up slowly', async () => {
    const fake = createFakeContext();
    const mixer = createAudioMixer<Sound, string>({
      context: fake.context,
      buffers: BUFFERS,
      volumes: { music: 0.5 },
    });
    await mixer.unlock();
    fake.clock.now = 10;

    mixer.duck({ depth: 0.4, attack: 0.05, hold: 0.3, release: 0.6 });

    const schedule = fake.gains[0]?.gain.schedule ?? [];
    expect(schedule.map(([kind, value, time]) => [kind, value, time ?? value])).toEqual([
      ['cancel', 10, 10],
      ['set', 0.5, 10],
      ['ramp', expect.closeTo(0.2), expect.closeTo(10.05)],
      ['set', expect.closeTo(0.2), expect.closeTo(10.35)],
      ['ramp', 0.5, expect.closeTo(10.95)],
    ]);
  });

  it('drops a duck when the music volume changes, so the new volume holds', async () => {
    const fake = createFakeContext();
    const mixer = createAudioMixer<Sound, string>({ context: fake.context, buffers: BUFFERS });
    await mixer.unlock();
    fake.clock.now = 3;
    mixer.duck({ depth: 0.4, attack: 0.05, hold: 0.3, release: 0.6 });

    mixer.setVolume('music', 0.8);

    expect(fake.gains[0]?.gain.schedule.at(-1)).toEqual(['cancel', 3]);
    expect(fake.gains[0]?.gain.value).toBe(0.8);
  });

  it('changes group volumes live, clamped to [0, 1]', () => {
    const fake = createFakeContext();
    const mixer = createAudioMixer<Sound, string>({ context: fake.context, buffers: BUFFERS });

    mixer.setVolume('effects', 1.5);
    mixer.setVolume('music', -1);

    expect(fake.gains.map((gain) => gain.gain.value)).toEqual([0, 1]);
    mixer.setVolume('music', Number.NaN);
    expect(mixer.getVolume('music')).toBe(0);
  });

  it('stays locked when the browser refuses to start audio, without throwing', async () => {
    const fake = createFakeContext({ refuseResume: true });
    const mixer = createAudioMixer<Sound, string>({ context: fake.context, buffers: BUFFERS });

    await expect(mixer.unlock()).resolves.toBeUndefined();

    expect(mixer.unlocked).toBe(false);
  });

  it('stops music, closes the context and goes silent on dispose', async () => {
    const fake = createFakeContext();
    const mixer = createAudioMixer<Sound, string>({ context: fake.context, buffers: BUFFERS });
    await mixer.unlock();
    mixer.playMusic('theme');

    await mixer.dispose();
    await mixer.dispose();
    await mixer.unlock();
    mixer.play('shot');

    expect(fake.sources).toHaveLength(1);
    expect(fake.sources[0]?.stopped).toBe(true);
    expect(fake.context.state).toBe('closed');
    expect(mixer.unlocked).toBe(false);
  });

  it('is a silent mixer without Web Audio and keeps the volumes for the settings screen', async () => {
    const mixer = createAudioMixer<Sound, string>({
      context: null,
      buffers: {},
      volumes: { music: 0.5 },
    });

    await mixer.unlock();
    mixer.play('shot');
    mixer.playMusic('theme');
    mixer.stopMusic();
    mixer.setVolume('effects', 0.25);
    await mixer.dispose();

    expect([mixer.available, mixer.unlocked]).toEqual([false, false]);
    expect([mixer.getVolume('music'), mixer.getVolume('effects')]).toEqual([0.5, 0.25]);
  });
});
