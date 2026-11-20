# ADR-0007: The backend

- **Status:** Accepted
- **Date:** 2026-11-20
- **Deciders:** Nazima Jumaniyazova

## Context

Plan stage 8 (#214) gives the game a backend: boards of verified records, replays anyone can
watch, accounts that start anonymous and can be linked to GitHub, and achievements kept across
devices. The plan names three candidates: Supabase, Firebase, and an API of our own on Cloudflare
Workers.

**The hard requirement.** A record counts only when the server plays its replay again with
`simulate` from the same `@buzzkill/game` as the browser and reaches the same score and state hash
(ADR-0009). So a server function must run the package, TypeScript without the DOM, within its CPU
limit.

**What re-simulation costs.** Measured on 2026-11-20:

- **Setup.** The package was bundled with esbuild (72 kB minified, `zod/mini` included) and run in
  Node 24 on the owner's laptop. CPU time was counted with `process.cpuUsage`, which includes the
  compiler and garbage collector threads.
- **A full run.** The golden replay `campaign-easy-night-female-11` wins all six levels in
  16,386 ticks, 4.5 minutes of play.
  - In a fresh process, as on a function's first request, it took 125 to 187 ms (5 runs).
  - Warm, it took 112 ms.
- **Per tick.**
  - The busiest part of the levels: 10.2 µs.
  - The queen's rage: 4.4 µs.
- **What a stalled run costs.** A run cannot be cut short from outside: a player who keeps
  dodging the queen can make a run last. At 10.2 µs a tick, a cap of 20 minutes (72,000 ticks)
  costs about 0.7 s warm. Cloud CPUs may be slower than the laptop, so a limit needs a margin of two
  or three times.

**The rest of the plan's stage 8 assumes SQL.**

- Migrations in the repository.
- Row Level Security: anyone reads, only the server function writes a run.
- Generated database types.
- An anonymous session that can be linked to GitHub.

**The platforms' current limits.** Read from their documentation on 2026-11-20:

|                                 | Supabase                                                                  | Firebase                                                   | Cloudflare Workers                                          |
| ------------------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------- | ----------------------------------------------------------- |
| Function runtime                | Deno (V8)                                                                 | Node                                                       | V8 isolates                                                 |
| CPU per request                 | 2 s, on every plan                                                        | Set by the timeout, 60 s by default                        | 10 ms free; 30 s on Workers Paid (up to 5 min)              |
| Database                        | Postgres, 500 MB free                                                     | Firestore (documents), daily free quotas                   | D1 (SQLite), 500 MB free                                    |
| Anonymous accounts, then GitHub | Built in (`signInAnonymously`, `linkIdentity`; manual linking is in beta) | Built in                                                   | Written by us                                               |
| Price to start                  | Free; paused after a week of low activity                                 | Blaze plan with a card; 2 million invocations a month free | Workers Paid at $5 a month, since 10 ms cannot verify a run |

## Options

### A. Supabase: Postgres, Auth and Edge Functions

- **Pros.**
  - Matches the plan item by item: SQL migrations, Row Level Security, `supabase gen types`,
    anonymous sign-in with GitHub linking, and an Edge Function for `submit-run`.
  - **CPU.** A full run takes under 0.2 s of the 2 s a request may use.
  - **Price.** The free plan covers the project: 500,000 function calls and 50,000 monthly users.
  - Postgres is a skill an interview can probe.
- **Cons.**
  - **Pausing.** A free project pauses after a week without activity, so the boards go dark between
    visits until someone wakes the project. The paid plan, which never pauses, costs $25 a month.
  - **Deno.** Edge Functions run Deno, not Node, so the function bundles `@buzzkill/game`
    rather than importing it from the workspace. A test checks that the bundle matches the browser's
    build.
  - **The CPU cap.** The 2 s are fixed, so `maxTicks` must stay well below them.
  - **Beta linking.** Linking an anonymous account to GitHub is in beta.

### B. Firebase: Firestore, Auth and Cloud Functions

- **Pros.**
  - Node functions with a generous timeout, so CPU is no constraint.
  - Anonymous accounts and linking are mature.
  - Free quotas are large.
- **Cons.**
  - **Billing.** Cloud Functions need the Blaze plan, which needs a card, even when the free quota
    covers the use.
  - **No SQL.** Firestore is a document store, so the plan's migrations, Row Level Security and
    generated types turn into security rules and hand-written types. Boards per day and per
    difficulty become composite indexes and denormalized documents.
  - **Lock-in.** It is the most proprietary of the three.

### C. An API of our own on Cloudflare Workers with D1

- **Pros.**
  - Full control and fast functions near the player.
  - D1 is SQLite with migrations.
  - Workers run the bundled package as the browser does.
- **Cons.**
  - **Price.** The free plan's 10 ms of CPU cannot verify even a short run, which takes 43 ms warm.
    Workers Paid, $5 a month, is required from the first record.
  - **No auth.** Anonymous sessions, GitHub OAuth and the linking between them must be written and
    secured by us.
  - **No Row Level Security.** Authorization lives in our code.
  - It is the most code to write and to defend in stage 10's security audit.

## Recommendation

A, Supabase. It is the only option that fits the plan without paying from the first day. It
verifies a full run in under a tenth of its CPU limit, and it gives the schema, the policies and
the accounts as features rather than code.

Its pausing is a cost of the free plan rather than a flaw. The game works offline and without the
backend (#222), so a paused project only hides the boards until it wakes.

## Decision

A, Supabase, chosen by the owner on 2026-11-20, on the free plan.

## Consequences

- **The project.** The owner creates it. Two of its values go to the web app as `.env` locally and
  as secrets in CI and on Vercel:
  - the project URL;
  - the public key.

  The service role key lives only in the function's secrets, never in the client or the
  repository.

- **The repository.** A `supabase/` folder at the root holds the Supabase CLI's configuration,
  the SQL migrations and the `submit-run` function (#215, #218).
  - The CLI is a development dependency, pinned like every other.
  - Commits there use a new scope, `backend`, added to commitlint.
- **Tests against a database.** The CLI runs a local Supabase in Docker, so the tests of the
  schema and the policies (#215, #216) run in CI on Linux. Locally they need Docker Desktop.
- **The function.**
  - It bundles `@buzzkill/game` with esbuild at build time, since Deno does not resolve the
    workspace.
  - CI checks that the browser and the function come from one commit (#218).
- **`maxTicks`.**
  - It is chosen in #218, well under the 2 s of CPU.
  - Its measured cost goes into ADR-0009, as that ADR asks.
- **Accounts.** The project enables anonymous sign-ins and manual identity linking, the latter in
  beta (#217). GitHub sign-in needs an OAuth app that the owner creates.
- **The client.**
  - `@supabase/supabase-js` loads only when the boards, a sign-in or a replay need it, never on
    load (#222).
  - Its cost is measured against the bundle budget (#220).
- **The free plan.** The project pauses after a week of low activity.
  - The boards then show that they are offline, as they do without a network.
  - Moving to the paid plan later changes the price, not the design.
