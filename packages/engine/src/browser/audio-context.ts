export interface AudioContextGlobals {
  readonly AudioContext?: typeof AudioContext;
}

/**
 * Creates the page's `AudioContext`, or returns `null` when Web Audio is missing or refuses to
 * start (some browsers limit the number of contexts). Create it before loading, so sounds can be
 * decoded while it is still suspended; `AudioMixer.unlock` starts it on the first gesture.
 */
export function createBrowserAudioContext(
  globals: AudioContextGlobals = globalThis,
): AudioContext | null {
  const AudioContextClass = globals.AudioContext;
  if (AudioContextClass === undefined) {
    return null;
  }
  try {
    return new AudioContextClass();
  } catch {
    return null;
  }
}
