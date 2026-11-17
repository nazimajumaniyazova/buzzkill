import { describe, expect, it } from 'vitest';

import {
  type AudioBufferSourceLike,
  type AudioContextLike,
  type AudioNodeLike,
  createAudioMixer,
  type GainNodeLike,
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
  const gains: (GainNodeLike & { target: AudioNodeLike | null })[] = [];
  const sources: FakeSource[] = [];
  const panners: (StereoPannerLike & { target: AudioNodeLike | null })[] = [];
  let state = 'suspended';
  const context: AudioContextLike<string> = {
    get state() {
      return state;
    },
    destination,
    createGain() {
      const gain = {
        gain: { value: 1 },
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
  return { context, destination, gains, sources, panners };
}

const BUFFERS = { shot: 'shot-buffer', theme: 'theme-buffer' };

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
