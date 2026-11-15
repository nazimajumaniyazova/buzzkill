import { type Game, type GameHud as Hud, LEVELS, QUEEN } from '@buzzkill/game';
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
const selectShield = (hud: Hud): number => hud.shield;
const selectRapidFire = (hud: Hud): number => hud.rapidFire;
const selectBossHealth = (hud: Hud): number => hud.bossHealth;
const selectBossMaxHealth = (hud: Hud): number => hud.bossMaxHealth;
const selectBossEnraged = (hud: Hud): boolean => hud.bossEnraged;

/** Where her rage begins along her bar, as a percentage of the most health she had. */
const RAGE_MARK = `${String((QUEEN.rage.part / QUEEN.rage.of) * 100)}%`;

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

/** The seconds left of a power-up's effect (#151), shown only while it lasts. */
function HudTimer({ game, term, select, show }: HudValueProps): JSX.Element | null {
  const seconds = useGameHud(game, select);
  if (seconds === 0) {
    return null;
  }
  return (
    <div>
      <dt>{term}</dt>
      <dd>{show(seconds)}</dd>
    </div>
  );
}

/**
 * The queen's health while she is in the world (#152): a meter a screen reader can visit, with her
 * name, and a bar that empties toward a mark where her rage begins and turns red from there.
 */
function BossBar({ game }: { readonly game: Game }): JSX.Element | null {
  const { t } = useI18n();
  const health = useGameHud(game, selectBossHealth);
  const max = useGameHud(game, selectBossMaxHealth);
  const enraged = useGameHud(game, selectBossEnraged);
  if (max === 0) {
    return null;
  }
  return (
    <div
      className="boss-bar"
      role="meter"
      aria-label={t.hud.boss}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={health}
      aria-valuetext={t.hud.bossHealth(health, max)}
      data-enraged={enraged}
    >
      <span className="boss-bar-name" aria-hidden="true">
        {t.hud.boss}
      </span>
      <span className="boss-bar-track" aria-hidden="true">
        <span className="boss-bar-fill" style={{ width: `${String((health / max) * 100)}%` }} />
        <span className="boss-bar-rage" style={{ left: RAGE_MARK }} />
      </span>
    </div>
  );
}

/**
 * Score, lives, ammo and the level over the canvas, the seconds left of a shield and of rapid
 * fire while they last, and the queen's health while she fights. The frame subscribes to nothing
 * but the language, so it renders once per run; each value subscribes through its own selector
 * (#109), so a shot renders the ammo and nothing else. The selectors pick numbers and the language writes them (ADR-0013).
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
        <HudTimer game={game} term={t.hud.shield} select={selectShield} show={t.hud.secondsLeft} />
        <HudTimer
          game={game}
          term={t.hud.rapidFire}
          select={selectRapidFire}
          show={t.hud.secondsLeft}
        />
      </dl>
      <BossBar game={game} />
    </section>
  );
}
