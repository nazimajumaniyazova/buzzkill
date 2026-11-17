import { useToast } from '@buzzkill/ui';
import { useEffect, useRef } from 'react';

import { useI18n } from './i18n/i18n';
import type { AchievementsState, Earned } from './state/achievements/store';
import type { ReadableStore } from './state/store';
import { useStore } from './state/use-store';

const selectEarned = (state: AchievementsState): Earned => state.earned;

/**
 * Shows a toast for each achievement earned (#163), under the toast provider. The provider puts
 * the text in a live region, so screen readers hear it wherever the player is. Each report is
 * shown once, even when the language changes and the strings with it. It alone reads the store,
 * and only what was earned: it renders for news, not for every insect.
 */
export function EarnedToasts({
  store,
}: {
  readonly store: ReadableStore<AchievementsState>;
}): null {
  const earned = useStore(store, selectEarned);
  const { show } = useToast();
  const { t } = useI18n();
  const shown = useRef(earned.serial);

  useEffect(() => {
    if (earned.serial === shown.current) {
      return;
    }
    shown.current = earned.serial;
    for (const id of earned.ids) {
      show({
        title: t.achievements.unlocked,
        description: t.achievements.items[id].name,
        tone: 'success',
        dismissLabel: t.common.close,
      });
    }
  }, [earned, show, t]);

  return null;
}
