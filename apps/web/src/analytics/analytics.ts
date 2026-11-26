import type { Difficulty, HeroId } from '@buzzkill/game';

/**
 * Where Umami Cloud collects events (ADR-0019): its documentation names this host for sending.
 * The owner checks it against the account's region when the account is made.
 */
export const ANALYTICS_ENDPOINT = 'https://gateway.umami.is/api/send';

/**
 * The events the game counts (#223), each with its properties: aggregates only, nothing that
 * names or follows a player. `slower` marks a run at a slower game speed (ADR-0014).
 */
interface AnalyticsEvents {
  readonly game_start: {
    readonly difficulty: Difficulty;
    readonly hero: HeroId;
    readonly slower: boolean;
  };
  readonly level_reached: { readonly level: number; readonly slower: boolean };
  /** A lost run: the level, and what struck the hero last: an enemy's id, a sting, the charge. */
  readonly death: { readonly level: number; readonly cause: string; readonly slower: boolean };
  readonly boss_defeated: { readonly slower: boolean };
  readonly daily_played: Readonly<Record<string, never>>;
  readonly replay_watched: Readonly<Record<string, never>>;
}

type EventName = keyof AnalyticsEvents;

export interface Analytics {
  /** Counts an event. Never throws, never waits, and may do nothing at all. */
  // A property, not a method: the shell hands it to the game view on its own.
  readonly track: <N extends EventName>(name: N, data: AnalyticsEvents[N]) => void;
}

/** The two signals a browser gives of a player who does not want to be counted. */
interface PrivacySignals {
  readonly doNotTrack: string | null | undefined;
  readonly globalPrivacyControl: boolean | undefined;
}

interface AnalyticsOptions {
  /** The environment of the build: `import.meta.env`. */
  readonly env: Readonly<Record<string, unknown>>;
  /** Where the game is served from: `location.hostname`. */
  readonly hostname: string;
  readonly privacy: PrivacySignals;
  readonly fetch: (url: string, init: RequestInit) => Promise<Response>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const NOTHING: Analytics = { track: () => undefined };

/**
 * The website id of a production build, or `null`: only production counts (ADR-0019). The build's
 * content security policy asks the same question.
 */
export function websiteIdOf(env: Readonly<Record<string, unknown>>): string | null {
  const id = env['VITE_UMAMI_WEBSITE_ID'];
  if (typeof id !== 'string') {
    return null;
  }
  const trimmed = id.trim();
  return UUID.test(trimmed) ? trimmed : null;
}

/**
 * The analytics of this page (ADR-0019). It counts nothing in a build without a website id, or
 * when the player's browser sends Do Not Track or Global Privacy Control; both are read once,
 * here. Otherwise each event is one request from the game's own code, with no script from another
 * domain, no cookie and nothing about the player or the page beyond where the game is. A request
 * that fails is dropped: analytics never queue, never retry and never show an error.
 */
export function createAnalytics({ env, hostname, privacy, fetch }: AnalyticsOptions): Analytics {
  const website = websiteIdOf(env);
  if (website === null || privacy.doNotTrack === '1' || privacy.globalPrivacyControl === true) {
    return NOTHING;
  }
  return {
    track(name, data) {
      const payload =
        Object.keys(data).length === 0
          ? { website, hostname, url: '/', name }
          : { website, hostname, url: '/', name, data };
      try {
        fetch(ANALYTICS_ENDPOINT, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ type: 'event', payload }),
          // The request outlives the page, so a death just before the tab closes still counts.
          keepalive: true,
          credentials: 'omit',
        }).catch(() => undefined);
      } catch {
        // A body too large for keepalive, or a fetch the browser refuses: the event is dropped.
      }
    },
  };
}
