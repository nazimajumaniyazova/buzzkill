/**
 * Browser entry of the engine (`@buzzkill/engine/browser`): the adapters that touch `window`,
 * `navigator` and DOM events. Everything else is in the headless main entry, which compiles
 * without the DOM lib so that the game and the server can import it.
 */
export { type BrowserAssetDecoderOptions, createBrowserAssetDecoders } from './asset-decoders';
export { type AudioContextGlobals, createBrowserAudioContext } from './audio-context';
export { type BrowserHostGlobals, createBrowserHost } from './browser-host';
export {
  createGamepadSource,
  type GamepadLike,
  type GamepadSource,
  type GamepadSourceOptions,
} from './gamepad';
export {
  createKeyboardSource,
  type KeyboardEventLike,
  type KeyboardSource,
  type KeyboardTarget,
} from './keyboard';
export { attachPointerButton, type PointerEventLike, type PointerTarget } from './pointer-button';
