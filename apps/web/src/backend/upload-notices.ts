import { createStore, type ReadableStore } from '../state/store';
import type { FlushReport } from './run-queue';

/**
 * What the player is told of the runs sent (#222). Sending is quiet while it works: a run that
 * reaches the server is what runs do. The player hears when a run has to wait, when runs that
 * waited went out, and when the server refused one.
 */
type UploadNotice =
  | { readonly kind: 'kept' }
  | { readonly kind: 'sent'; readonly count: number }
  | { readonly kind: 'refused'; readonly count: number };

/**
 * Why the queue was sent: a run just `finished`, or the runs `waiting` from an earlier visit or
 * for the network got their chance.
 */
export type SendReason = 'finished' | 'waiting';

/** What one sending has to say to the player; nothing, mostly. */
export function noticesOf(report: FlushReport, reason: SendReason): readonly UploadNotice[] {
  const notices: UploadNotice[] = [];
  if (report.refused > 0) {
    notices.push({ kind: 'refused', count: report.refused });
  }
  if (reason === 'finished') {
    // The run just played is the last of the queue: while anything is left, it waits.
    if (report.left > 0) {
      notices.push({ kind: 'kept' });
    }
  } else if (report.stored.length > 0) {
    notices.push({ kind: 'sent', count: report.stored.length });
  }
  return notices;
}

/**
 * The most notices the news keeps. The toasts read them as they come, so these are only the ones
 * of sends that end before the page renders again.
 */
export const MAX_UPLOAD_NOTICES = 8;

/** A notice with the place it came in, from 1. */
export type NumberedNotice = UploadNotice & { readonly serial: number };

/** The notices of the sends, the latest last, for the toasts to read. */
export interface UploadNews extends ReadableStore<readonly NumberedNotice[]> {
  /** Tells of a sending. Two callers given the same sending report it once between them. */
  readonly report: (report: FlushReport, reason: SendReason) => void;
}

const NONE: readonly NumberedNotice[] = [];

export function createUploadNews(): UploadNews {
  const store = createStore<readonly NumberedNotice[], readonly UploadNotice[]>((kept, notices) => {
    const next = kept.at(-1)?.serial ?? 0;
    const numbered = notices.map((notice, index) => ({ ...notice, serial: next + index + 1 }));
    return [...kept, ...numbered].slice(-MAX_UPLOAD_NOTICES);
  }, NONE);
  // A flush during a sending returns the report of that sending, the same object.
  let last: FlushReport | null = null;
  return {
    getState: store.getState,
    subscribe: store.subscribe,
    report(report, reason) {
      if (report === last) {
        return;
      }
      last = report;
      const notices = noticesOf(report, reason);
      if (notices.length > 0) {
        store.send(notices);
      }
    },
  };
}
