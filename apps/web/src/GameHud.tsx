import { type Game, type GameHud as Hud, LEVELS } from '@buzzkill/game';
import type { JSX } from 'react';

import { useI18n } from './i18n/i18n';
import { useGameHud } from './state/use-game-hud';

interface GameHudProps {
  readonly game: Game;
  /** The lives a run starts with at its difficulty (#155). */
  readonly maxLives: number;
}

interface HudValueProps {
  readonly game: Game;
  readonly term: string;
  readonly select: (hud: Hud) => number;
  /** The value as the current language writes it. */
  readonly show: (value: number) => string;
}

const selectScore = (hud: Hud): number => hud.score;
const selectLives = (hud: Hud): number => hud.lives;
const selectAmmo = (hud: Hud): number => hud.ammo;
const selectLevel = (hud: Hud): number => hud.level;

/** One value of the HUD, subscribed on its own: it renders only when that value changes. */
function HudValue({ game, term, select, show }: HudValueProps): JSX.Element {
  const value = useGameHud(game, select);
  return (
    <div>
      <dt>{term}</dt>
      <dd>{show(value)}</dd>
    </div>
  );
}

/**
 * Score, lives, ammo and the level over the canvas. The frame subscribes to nothing but the language, so it
 * renders once per run; each value subscribes through its own selector (#109), so a shot renders
 * the ammo and nothing else. The selectors pick numbers and the language writes them (ADR-0013).
 * The pause and the end of the run are the machine's business, through the bridge.
 */
export function GameHud({ game, maxLives }: GameHudProps): JSX.Element {
  const { t, format } = useI18n();
  return (
    <section className="hud" aria-label={t.hud.label}>
      <dl>
        <HudValue game={game} term={t.hud.score} select={selectScore} show={format.number} />
        <HudValue
          game={game}
          term={t.hud.lives}
          select={selectLives}
          show={(lives) => t.hud.livesValue(lives, maxLives)}
        />
        <HudValue game={game} term={t.hud.ammo} select={selectAmmo} show={format.number} />
        <HudValue
          game={game}
          term={t.hud.level}
          select={selectLevel}
          show={(level) => t.hud.levelValue(level, LEVELS.length)}
        />
      </dl>
    </section>
  );
}
