import type { JSX } from 'react';

/**
 * Application shell. For now it renders only the full-screen canvas the game
 * engine will draw into; menus, HUD and settings arrive with the design system.
 */
export function App(): JSX.Element {
  return <canvas className="game-canvas" role="img" aria-label="Buzzkill game screen" />;
}
