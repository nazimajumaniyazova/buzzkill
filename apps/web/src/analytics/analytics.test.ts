// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

import { ANALYTICS_ENDPOINT, createAnalytics } from './analytics';

const WEBSITE = '0f1e2d3c-4b5a-4968-8778-695a4b3c2d1e';

/** The JSON a request carried. */
function bodyOf(init: RequestInit | undefined): unknown {
  return typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
}

function setup(overrides: Partial<Parameters<typeof createAnalytics>[0]> = {}) {
  const fetch = vi.fn((_url: string, _init: RequestInit) =>
    Promise.resolve(new Response('{}', { status: 200 })),
  );
  const analytics = createAnalytics({
    env: { VITE_UMAMI_WEBSITE_ID: WEBSITE },
    hostname: 'buzzkill.example',
    privacy: { doNotTrack: null, globalPrivacyControl: undefined },
    fetch,
    ...overrides,
  });
  return { analytics, fetch };
}

describe('createAnalytics', () => {
  it('posts an event with its properties, and nothing about the player or the page', () => {
    const { analytics, fetch } = setup();

    analytics.track('death', { level: 3, cause: 'hornet', slower: false });

    expect(fetch).toHaveBeenCalledOnce();
    const [url, init] = fetch.mock.calls[0] ?? [];
    expect(url).toBe(ANALYTICS_ENDPOINT);
    expect(init).toMatchObject({
      method: 'POST',
      keepalive: true,
      credentials: 'omit',
      headers: { 'content-type': 'application/json' },
    });
    // No language, screen, referrer or title: only where the game is and what happened in it.
    expect(bodyOf(init)).toEqual({
      type: 'event',
      payload: {
        website: WEBSITE,
        hostname: 'buzzkill.example',
        url: '/',
        name: 'death',
        data: { level: 3, cause: 'hornet', slower: false },
      },
    });
  });

  it('sends an event without properties without data', () => {
    const { analytics, fetch } = setup();

    analytics.track('replay_watched', {});

    expect(bodyOf(fetch.mock.calls[0]?.[1])).toEqual({
      type: 'event',
      payload: { website: WEBSITE, hostname: 'buzzkill.example', url: '/', name: 'replay_watched' },
    });
  });

  it('sends nothing in a build without a website id, as in development, previews and tests', () => {
    for (const env of [
      {},
      { VITE_UMAMI_WEBSITE_ID: ' ' },
      { VITE_UMAMI_WEBSITE_ID: 'not-an-id' },
    ]) {
      const { analytics, fetch } = setup({ env });
      analytics.track('game_start', { difficulty: 'normal', hero: 'male', slower: false });
      expect(fetch).not.toHaveBeenCalled();
    }
  });

  it('sends nothing under Do Not Track or Global Privacy Control', () => {
    for (const privacy of [
      { doNotTrack: '1', globalPrivacyControl: undefined },
      { doNotTrack: null, globalPrivacyControl: true },
    ]) {
      const { analytics, fetch } = setup({ privacy });
      analytics.track('daily_played', {});
      expect(fetch).not.toHaveBeenCalled();
    }

    const { analytics, fetch } = setup({
      privacy: { doNotTrack: '0', globalPrivacyControl: false },
    });
    analytics.track('daily_played', {});
    expect(fetch).toHaveBeenCalledOnce();
  });

  it('reads the privacy signals once, when it is made', () => {
    const privacy = { doNotTrack: null as string | null, globalPrivacyControl: undefined };
    const { analytics, fetch } = setup({ privacy });

    privacy.doNotTrack = '1';
    analytics.track('boss_defeated', { slower: false });

    expect(fetch).toHaveBeenCalledOnce();
  });

  it('drops a failed send, once, without a retry or an error anyone sees', async () => {
    const rejecting = vi.fn(() => Promise.reject(new TypeError('Failed to fetch')));
    const throwing = vi.fn(() => {
      throw new TypeError('keepalive body too large');
    });
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);
    try {
      for (const fetch of [rejecting, throwing]) {
        const { analytics } = setup({ fetch });
        expect(() => {
          analytics.track('level_reached', { level: 2, slower: true });
        }).not.toThrow();
        expect(fetch).toHaveBeenCalledOnce();
      }
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(unhandled).not.toHaveBeenCalled();
    } finally {
      process.off('unhandledRejection', unhandled);
    }
  });
});
