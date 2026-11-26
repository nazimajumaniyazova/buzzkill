import { useToast } from '@buzzkill/ui';
import { useEffect, useRef } from 'react';

import type { NumberedNotice, UploadNews } from './backend/upload-notices';
import { useI18n } from './i18n/i18n';
import { useStore } from './state/use-store';

const selectNotices = (notices: readonly NumberedNotice[]): readonly NumberedNotice[] => notices;

/**
 * Shows a toast for what became of the runs sent (#222), under the toast provider, which reads it
 * out in its live region. Nothing here is an error: a run that waits is kept, and the game plays
 * on. Each notice is shown once, even when the language changes, and none is missed when two
 * sends end before the page renders.
 */
export function UploadToasts({ news }: { readonly news: UploadNews }): null {
  const notices = useStore(news, selectNotices);
  const { show } = useToast();
  const { t } = useI18n();
  // What was there before this mounted is old news.
  const shown = useRef(notices.at(-1)?.serial ?? 0);

  useEffect(() => {
    for (const notice of notices) {
      if (notice.serial <= shown.current) {
        continue;
      }
      shown.current = notice.serial;
      switch (notice.kind) {
        case 'kept':
          show({
            title: t.uploads.kept,
            description: t.uploads.keptDetail,
            dismissLabel: t.common.close,
          });
          break;
        case 'sent':
          show({
            title: t.uploads.sent(notice.count),
            tone: 'success',
            dismissLabel: t.common.close,
          });
          break;
        case 'refused':
          show({ title: t.uploads.refused(notice.count), dismissLabel: t.common.close });
          break;
      }
    }
  }, [notices, show, t]);

  return null;
}
