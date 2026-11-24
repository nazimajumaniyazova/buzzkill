# ADR-0019: Analytics without cookies

- **Status:** Accepted
- **Date:** 2026-11-23
- **Deciders:** Nazima Jumaniyazova

## Context

Plan stage 8, item 11 (#223) asks for analytics that show where players lose, so that the balance
configuration can change for a reason. It sets the limits:

- **No cookies and no personal data.** Only aggregated events.
- **The events.**
  - `game_start`;
  - `level_reached`;
  - `death`, with the level and the type of enemy;
  - `boss_defeated`;
  - `daily_played`;
  - `replay_watched`.
- **Do Not Track and Global Privacy Control.** Nothing is sent while the browser asks for either.
- **The content security policy** allows the analytics domain and nothing more.

The plan names Plausible and Umami, each in the cloud or self-hosted. This is the owner's
decision.

Facts that shape the options:

- **No content security policy yet.** `apps/web/vercel.json` sends `nosniff`, `X-Frame-Options`,
  `Referrer-Policy` and `Permissions-Policy`. The strict policy is stage 10, item 1.
- **What the game knows about a death.** The game reports `playerHit` with the lives left but not
  what struck the hero, so `death` cannot name the enemy yet.
- **How many events a run sends.** A campaign has six levels. A lost run sends `game_start`, one
  `level_reached` per level after the first, and `death`: from 2 to 7 events. Their properties
  (difficulty, level, enemy) add 1 or 2 values each.
- **Both services take events over HTTP.** Each documents an endpoint that takes an event as JSON
  from a `fetch`: Plausible's `POST /api/event` and Umami's `POST /api/send`. The game does not
  need their script, so the page runs no code from another domain.

Prices and limits were read on the services' own pages on 2026-11-23.

## Options

### A. Umami Cloud, the free Hobby plan

- **Pros.**
  - $0 a month, no card.
  - 100,000 events a month, 6 months of history.
  - Custom events with properties are on the free plan.
  - Data in the EU, a region chosen when the account is made.
  - No cookies, no personal data, per its pricing page.
  - Umami itself is MIT-licensed: if the plan stops being free, the same events can go to a
    self-hosted Umami without changes to the game.
- **Cons.**
  - Each stored property counts as an event. A run uses from 5 to about 15 of the 100,000, so
    the plan holds about 6,500 to 20,000 runs a month. Above that the Hobby plan stores nothing
    more until the next month; the game is not affected.
  - One website per account.
  - 6 months of history: enough to balance from, not to compare years.
  - Its documentation calls Do Not Track deprecated, so the game checks DNT and GPC itself.

### B. Plausible Cloud, the Business plan

- **Pros.**
  - Made and hosted in the EU.
  - No cookies and no persistent identifiers; the IP address is not stored.
  - A mature dashboard, with funnels for a path like "start → level 3 → boss".
  - 30 days free with every feature.
- **Cons.**
  - $19 a month after the trial, for 10,000 events a month.
  - Properties on events (`death` with its level and enemy) need the Business plan. The $9
    Starter plan has custom events without properties, so the level and the enemy would have to
    be folded into event names (`death_level_3_bat`), which the dashboard cannot group.
  - Properties do not count, but events do: 10,000 hold about 1,400 to 5,000 runs a month.
  - Self-hosting it means Docker with ClickHouse and at least 2 GB of RAM: a server to run.

### C. Our own counters in Supabase

A table of daily counts per event and property, which one function or SQL call increments. The
backend of ADR-0007 is already there.

- **Pros.**
  - No new service, no new domain, no new account.
  - No visitor or session at all: only counts per day.
  - The balancing queries are SQL next to the runs.
- **Cons.**
  - Everything a service gives is ours to build and to keep: the endpoint, rate limits against
    floods, and a dashboard. In the meantime, queries run in the Supabase Studio.
  - The free database (500 MB) and its invocations are shared with the boards.
  - A free Supabase project pauses after a week of low activity, and the counts stop with it.
  - The plan names Plausible and Umami; this option leaves them.

## Recommendation

Option A, Umami Cloud on the free plan, in the EU region:

- **Cost.** It is the only option at $0 with properties on events, and `death` needs its level
  and its enemy to say where players lose.
- **Volume.** The volume of a portfolio game fits the free plan.
- **No lock-in.** Umami is MIT-licensed, so a self-hosted Umami takes the same events if the free
  plan changes.

## Decision

A, Umami Cloud on the free plan, in the EU region, chosen by the owner on 2026-11-24.

The owner creates the account and the website in the EU region. The website id then goes to
Vercel as an environment variable of production builds only; it is not a secret, since every page
that sends events carries it.

## Consequences

The following apply to option A. Options B and C change the endpoint and the account, not the
shape.

- **One module, one interface.**
  - `apps/web/src/analytics` holds `track(event)`, with a union type of the six events.
  - Behind it, one sender posts to the collection endpoint with `fetch` and `keepalive`. Nothing
    else in the app knows the service.
  - A failed send is dropped without a retry: analytics never queue, never show an error and
    never slow the game.
- **No script from another domain.** The game sends events from its own code, not with the
  service's tracker, so no page view, referrer or screen size is sent. The page loads no script
  from another domain.
- **Do Not Track and Global Privacy Control.**
  - `navigator.doNotTrack === '1'` or `navigator.globalPrivacyControl === true` turns `track` into
    nothing, checked once when the app starts.
  - Tests cover both.
- **Only production counts.**
  - The website id comes from a Vite environment variable that is set only for production builds
    on Vercel.
  - Without it, as in development, previews, tests and end-to-end runs, `track` does nothing.
- **The content security policy.**
  - #223 adds the header with a `connect-src` of `'self'`, the Supabase project and the
    collection domain. The exact domain of the EU region is read when the account is made.
  - Stage 10 builds the strict policy around it.
- **The cause of a death.** `playerHit` in `packages/game` gains what struck the hero: an enemy's
  `id`, a sting, or the boss's charge. Events do not change the simulation, so replays and the
  golden runs stay the same.
- **Where events fire.**
  - The events come from the state machine's transitions and the game's events, outside the hot
    loop.
  - `death` is the `runEnded` of a lost run, with the level and the last cause of `playerHit`.
  - A run at a slower game speed (ADR-0014) is marked with a property.
- **Bundle.** The sender is a few hundred bytes in the main chunk, measured in the PR.
- **Documentation.**
  - The README says what is counted and that nothing personal is.
  - The context diagram of `docs/architecture.md` loses the "planned" mark of the analytics.
  - `docs/balancing.md` starts once there are numbers to read: where players lose most, and what
    the balance configuration changed because of it.
