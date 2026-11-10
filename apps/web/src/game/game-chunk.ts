/**
 * The entry of the game chunk (#112): what a run needs and the menus do not. The game view with
 * the simulation, the loop, the renderer and the HUD, the drawing code, the asset manifest and its
 * loading. The shell reaches it only through `importGameChunk`, so the menu appears before any of
 * it downloads; dependency-cruiser rejects a static import of these modules.
 */
export { GameView } from '../GameView';
export { loadGameAssets } from './load-assets';
