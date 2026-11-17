/**
 * Sound for the game on Web Audio: effects and music play from buffers decoded during loading,
 * through one gain node per volume group. The 2023 code created an `Audio` element per sound and
 * set its volume each time; here a sound is one cheap buffer source, and a volume change is one
 * write to a gain node.
 *
 * Browsers start an `AudioContext` suspended until a user gesture (the autoplay policy). Sounds
 * requested before `unlock()` are dropped rather than queued, so nothing bursts out at once when
 * audio starts. Without Web Audio the mixer still exists and does nothing, so the game runs
 * silently instead of failing.
 *
 * The module is typed against the part of Web Audio it uses, so the engine core stays headless
 * and tests use a fake context. `AudioContext` satisfies `AudioContextLike<AudioBuffer>`.
 */

export type VolumeGroup = 'music' | 'effects';

export interface AudioParamLike {
  value: number;
}

/** A parameter that changes on a schedule of the context's clock, such as a gain. */
export interface AutomatedParamLike extends AudioParamLike {
  cancelScheduledValues(time: number): unknown;
  setValueAtTime(value: number, time: number): unknown;
  linearRampToValueAtTime(value: number, time: number): unknown;
}

export interface AudioNodeLike {
  connect(destination: AudioNodeLike): unknown;
}

export interface GainNodeLike extends AudioNodeLike {
  readonly gain: AutomatedParamLike;
}

/**
 * The part of an `<audio>` element the mixer drives: music streams from one (#161) instead of
 * being decoded whole before the first frame.
 */
export interface MediaElementLike {
  loop: boolean;
  play(): Promise<void>;
  pause(): void;
}

/** How the music gets out of the way of a loud sound (#161), in seconds and a part of its volume. */
export interface DuckOptions {
  /** The part of its volume the music keeps while ducked, from 0 to 1. */
  readonly depth: number;
  /** How long the music takes to go down. */
  readonly attack: number;
  /** How long it stays down. */
  readonly hold: number;
  /** How long it takes to come back. */
  readonly release: number;
}

export interface AudioBufferSourceLike<TBuffer> extends AudioNodeLike {
  buffer: TBuffer | null;
  loop: boolean;
  /** The speed and pitch together: 1 is the sound as recorded. */
  readonly playbackRate: AudioParamLike;
  start(): void;
  stop(): void;
}

/** Places a sound between the left speaker (-1) and the right one (1). */
export interface StereoPannerLike extends AudioNodeLike {
  readonly pan: AudioParamLike;
}

/** How an effect plays (#161): at another rate, and placed between the speakers. */
export interface PlayOptions {
  /** The playback rate, which raises or lowers the pitch with the speed. Default 1. */
  readonly rate?: number;
  /** From -1, the left speaker, to 1, the right one; clamped. Default 0, the middle. */
  readonly pan?: number;
}

export interface AudioContextLike<TBuffer> {
  /** `suspended` until a gesture resumes it, then `running`; `closed` after `close()`. */
  readonly state: string;
  readonly destination: AudioNodeLike;
  /** The context's clock in seconds, which schedules the ducking of the music. */
  readonly currentTime: number;
  createGain(): GainNodeLike;
  createBufferSource(): AudioBufferSourceLike<TBuffer>;
  /** Missing in some older browsers, where sounds play from the middle. */
  createStereoPanner?(): StereoPannerLike;
  /** Takes an element's sound into the graph; an element can have only one such source. */
  createMediaElementSource?(element: MediaElementLike): AudioNodeLike;
  resume(): Promise<void>;
  close(): Promise<void>;
}

export interface AudioMixerOptions<TSound extends string, TBuffer> {
  /** `null` when Web Audio is unavailable; the mixer is then silent. */
  readonly context: AudioContextLike<TBuffer> | null;
  /** Decoded sounds by name. A missing one is skipped when played. */
  readonly buffers: Readonly<Partial<Record<TSound, TBuffer | undefined>>>;
  /** Initial volumes from 0 to 1. Default 1 for both groups. */
  readonly volumes?: Readonly<Partial<Record<VolumeGroup, number>>>;
}

export interface AudioMixer<TSound extends string> {
  /** False without Web Audio: every call is then a no-op. */
  readonly available: boolean;
  /** True once the context runs and sounds are heard. */
  readonly unlocked: boolean;
  /**
   * Starts audio. Call it from a user gesture handler, such as the Play button; browsers refuse
   * to start audio otherwise. Never rejects: if the browser refuses, `unlocked` stays false and
   * the next gesture can try again.
   */
  unlock(): Promise<void>;
  /**
   * Plays an effect once, at the rate and the pan of `options`. Dropped while locked, after
   * dispose, or when its buffer is missing.
   */
  play(sound: TSound, options?: PlayOptions): void;
  /** Loops a music track, replacing the current one. Same rules as `play`. */
  playMusic(sound: TSound): void;
  /**
   * Loops the music of a media element through the music group, replacing the current music
   * (#161). Same rules as `play`; a start the browser refuses is let be.
   */
  streamMusic(element: MediaElementLike): void;
  stopMusic(): void;
  /** Lowers the music for a moment and brings it back (#161). Nothing while locked. */
  duck(options: DuckOptions): void;
  /** Sets a group's volume, clamped to [0, 1]. Applies to sounds already playing. */
  setVolume(group: VolumeGroup, volume: number): void;
  getVolume(group: VolumeGroup): number;
  /** Stops everything and closes the context. */
  dispose(): Promise<void>;
}

export function createAudioMixer<TSound extends string, TBuffer>(
  options: AudioMixerOptions<TSound, TBuffer>,
): AudioMixer<TSound> {
  const { context, buffers } = options;
  const volumes: Record<VolumeGroup, number> = {
    music: clampVolume(options.volumes?.music ?? 1),
    effects: clampVolume(options.volumes?.effects ?? 1),
  };
  if (context === null) {
    return createSilentMixer(volumes);
  }

  const groups: Record<VolumeGroup, GainNodeLike> = {
    music: context.createGain(),
    effects: context.createGain(),
  };
  for (const group of ['music', 'effects'] as const) {
    groups[group].gain.value = volumes[group];
    groups[group].connect(context.destination);
  }

  let disposed = false;
  let music: AudioBufferSourceLike<TBuffer> | null = null;
  let stream: MediaElementLike | null = null;
  /** The source of each element streamed so far: the browser makes only one per element. */
  const streamed = new WeakMap<MediaElementLike, AudioNodeLike>();

  /** A started source for `sound` in `group`, or null when nothing should play. */
  const start = (
    sound: TSound,
    group: VolumeGroup,
    loop: boolean,
    options?: PlayOptions,
  ): AudioBufferSourceLike<TBuffer> | null => {
    const buffer = buffers[sound];
    if (disposed || context.state !== 'running' || buffer === undefined) {
      return null;
    }
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = loop;
    source.playbackRate.value = options?.rate ?? 1;
    const pan = options?.pan ?? 0;
    if (pan !== 0 && context.createStereoPanner !== undefined) {
      const panner = context.createStereoPanner();
      panner.pan.value = Math.min(1, Math.max(-1, pan));
      source.connect(panner);
      panner.connect(groups[group]);
    } else {
      source.connect(groups[group]);
    }
    source.start();
    return source;
  };

  const stopMusic = (): void => {
    music?.stop();
    music = null;
    stream?.pause();
    stream = null;
  };

  return {
    available: true,
    get unlocked() {
      return !disposed && context.state === 'running';
    },
    async unlock() {
      if (disposed || context.state === 'running') {
        return;
      }
      try {
        await context.resume();
      } catch {
        // The browser refused (no gesture yet); the next gesture can try again.
      }
    },
    play(sound, options) {
      start(sound, 'effects', false, options);
    },
    playMusic(sound) {
      stopMusic();
      music = start(sound, 'music', true);
    },
    streamMusic(element) {
      stopMusic();
      if (
        disposed ||
        context.state !== 'running' ||
        context.createMediaElementSource === undefined
      ) {
        return;
      }
      if (!streamed.has(element)) {
        const source = context.createMediaElementSource(element);
        source.connect(groups.music);
        streamed.set(element, source);
      }
      element.loop = true;
      stream = element;
      // The autoplay policy may still refuse; the next stream can try again.
      element.play().catch(() => undefined);
    },
    stopMusic,
    duck({ depth, attack, hold, release }) {
      if (disposed || context.state !== 'running') {
        return;
      }
      const { gain } = groups.music;
      const now = context.currentTime;
      const full = volumes.music;
      const low = full * clampVolume(depth);
      gain.cancelScheduledValues(now);
      gain.setValueAtTime(gain.value, now);
      gain.linearRampToValueAtTime(low, now + attack);
      gain.setValueAtTime(low, now + attack + hold);
      gain.linearRampToValueAtTime(full, now + attack + hold + release);
    },
    setVolume(group, volume) {
      volumes[group] = clampVolume(volume);
      // A change of volume drops a duck under way, so the new volume holds.
      groups[group].gain.cancelScheduledValues(context.currentTime);
      groups[group].gain.value = volumes[group];
    },
    getVolume(group) {
      return volumes[group];
    },
    async dispose() {
      if (disposed) {
        return;
      }
      stopMusic();
      disposed = true;
      await context.close();
    },
  };
}

function createSilentMixer<TSound extends string>(
  volumes: Record<VolumeGroup, number>,
): AudioMixer<TSound> {
  const nothing = (): void => undefined;
  return {
    available: false,
    unlocked: false,
    unlock: () => Promise.resolve(),
    play: nothing,
    playMusic: nothing,
    streamMusic: nothing,
    stopMusic: nothing,
    duck: nothing,
    setVolume(group, volume) {
      volumes[group] = clampVolume(volume);
    },
    getVolume(group) {
      return volumes[group];
    },
    dispose: () => Promise.resolve(),
  };
}

function clampVolume(volume: number): number {
  return Number.isNaN(volume) ? 0 : Math.min(1, Math.max(0, volume));
}
