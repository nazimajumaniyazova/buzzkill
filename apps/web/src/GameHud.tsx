import { type Game, type GameHud as Hud, RULES } from '@buzzkill/game';
import type { JSX } from 'react';

import { useGameHud } from './state/use-game-hud';

interface GameHudProps {
  readonly game: Game;
}

interface HudValueProps {
  readonly game: Game;
  readonly term: string;
  readonly select: (hud: Hud) => number | string;
}

const selectScore = (hud: Hud): number => hud.score;
const selectLives = (hud: Hud): string => `${String(hud.lives)} of ${String(RULES.lives)}`;
const selectAmmo = (hud: Hud): number => hud.ammo;

/** One value of the HUD, subscribed on its own: it renders only when that value changes. */
function HudValue({ game, term, select }: HudValueProps): JSX.Element {
  const value = useGameHud(game, select);
  return (
    <div>
      <dt>{term}</dt>
      <dd>{value}</dd>
    </div>
  );
}

/**
 * Score, lives and ammo over the canvas. The frame subscribes to nothing, so it renders once per
 * run; each value subscribes through its own selector (#109), so a shot renders the ammo and
 * nothing else. The pause and the end of the run are the machine's business, through the bridge.
 */
export function GameHud({ game }: GameHudProps): JSX.Element {
  return (
    <section className="hud" aria-label="Game status">
      <dl>
        <HudValue game={game} term="Score" select={selectScore} />
        <HudValue game={game} term="Lives" select={selectLives} />
        <HudValue game={game} term="Ammo" select={selectAmmo} />
      </dl>
    </section>
  );
}
