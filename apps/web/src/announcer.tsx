import { VisuallyHidden } from '@buzzkill/ui';
import { createContext, type JSX, type ReactNode, use } from 'react';

import { createStore, type ReadableStore } from './state/store';
import { useStore } from './state/use-store';

/** How a screen reader should read a message: after what it is reading, or at once. */
type Politeness = 'polite' | 'assertive';

/** Says `message` to screen readers; polite unless told otherwise. */
export type Announce = (message: string, politeness?: Politeness) => void;

interface Announcement {
  readonly message: string;
  readonly politeness: Politeness;
  /** A new one for every call, so the same words said twice are read twice. */
  readonly id: number;
}

/** The latest announcement, read by the live regions, and the function that makes one. */
export interface Announcer extends ReadableStore<Announcement | null> {
  readonly announce: Announce;
}

export function createAnnouncer(): Announcer {
  let count = 0;
  const store = createStore(
    (_previous: Announcement | null, next: Announcement) => next,
    null as Announcement | null,
  );
  return {
    getState: store.getState,
    subscribe: store.subscribe,
    announce(message, politeness = 'polite') {
      count += 1;
      store.send({ message, politeness, id: count });
    },
  };
}

// Without a provider, a component renders on its own in a test and its announcements go nowhere.
const AnnounceContext = createContext<Announce>(() => undefined);

const whole = <T,>(value: T): T => value;

/**
 * The two live regions of the page (#114): a polite one, read after what the screen reader is
 * reading, and an assertive one, read at once. Both are always in the page, since a region that
 * appears together with its text is often not read. Each message is a new node, and the other
 * region empties, so no old message is left to find. Both are logs of the run's events; the
 * `status` and `alert` roles belong to the screens' own messages.
 */
function LiveRegions({ announcer }: { readonly announcer: Announcer }): JSX.Element {
  const announcement = useStore(announcer, whole);
  const text = (politeness: Politeness): ReactNode =>
    announcement?.politeness === politeness && (
      <span key={announcement.id}>{announcement.message}</span>
    );

  return (
    <>
      <VisuallyHidden role="log" aria-live="polite">
        {text('polite')}
      </VisuallyHidden>
      <VisuallyHidden role="log" aria-live="assertive">
        {text('assertive')}
      </VisuallyHidden>
    </>
  );
}

/** Gives `children` the announcer's `announce` and puts its live regions after them. */
export function AnnouncerProvider({
  announcer,
  children,
}: {
  readonly announcer: Announcer;
  readonly children: ReactNode;
}): JSX.Element {
  return (
    <AnnounceContext value={announcer.announce}>
      {children}
      <LiveRegions announcer={announcer} />
    </AnnounceContext>
  );
}

/** The `announce` of the nearest provider; one that says nothing without a provider. */
export function useAnnounce(): Announce {
  return use(AnnounceContext);
}
