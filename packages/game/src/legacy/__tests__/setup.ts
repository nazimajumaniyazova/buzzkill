import { vi } from 'vitest';

// jsdom implements neither media playback nor the 2D canvas. The legacy code plays a sound on
// almost every event and builds placeholder sprites on a canvas, so both are stubbed here instead
// of in every test. `getContext` returning null makes `placeholderSprite` return an empty data URL.
vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(() => Promise.resolve());
vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => null);
