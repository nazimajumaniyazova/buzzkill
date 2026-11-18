import { type HeroConfig, HEROES, type HeroId } from '../config/rules';
import { type AchievementProgress, unlocked } from './achievements';

/**
 * Whether `progress` has unlocked the hero (#164): Mike and Julie from the start, the others once
 * the achievement of their configuration is earned. The unlocks are kept with the achievements, so
 * the shell keeps nothing of its own for them.
 */
export function heroUnlocked(heroId: HeroId, progress: AchievementProgress): boolean {
  const { unlockedBy }: HeroConfig = HEROES[heroId];
  return unlockedBy === undefined || unlocked(progress).includes(unlockedBy);
}
