# ADR-0009: Determinism and replays

- **Status:** Accepted
- **Date:** 2026-11-02
- **Deciders:** Nazima Jumaniyazova

## Context

Stage 8 verifies leaderboard entries by re-running the player's replay on the server (a Supabase
Edge Function on Deno) with the same `@buzzkill/game` build and comparing score and final state.
That only works if the simulation is a pure function of `(seed, inputs)`: bit-identical results in
every browser and in Node and Deno. The same property gives reproducible bug reports (`?seed=`),
golden-replay tests and a replay viewer for free.

The 2023 code is the opposite: `Math.random()` everywhere, `requestAnimationFrame` deltas drive
physics, `Math.sin` moves enemies, and the input handler stores raw key names.

What is deterministic in JavaScript by specification: IEEE 754 `+ - * /`, `Math.sqrt`, `Math.floor`
and friends, integer bit operations, array iteration. What is **not**: `Math.sin`, `Math.cos`,
`Math.tan`, `Math.atan2`, `Math.exp`, `Math.log`, `Math.pow` with a fractional exponent,
`Math.hypot` (implementation-defined precision), `Math.random`, `Date.now`, `performance.now`, and
anything that depends on frame timing.

## Options

### A. Fixed-tick float simulation with restricted math and a seeded RNG

- Simulation time is an integer tick counter; `dt` is a constant (60 Hz). Real time only decides how
  many ticks to run and how to interpolate the render.
- All randomness comes from a seeded 32-bit generator inside the world state. `sfc32` (128-bit state,
  good statistical quality, ~10 lines) seeded from a 32-bit seed through `splitmix32`; `mulberry32`
  is the simpler alternative with weaker quality.
- Transcendental functions are banned in `packages/game` by ESLint (already in place); the engine
  provides table-based `sin`/`cos` with linear interpolation and integer-safe helpers.
- Entities live in arrays with a fixed iteration order; removal is swap-remove, which is
  deterministic because the sequence of operations is.
- Inputs are actions (`moveUp`, `moveDown`, `fire`, `pause`), recorded as changes of the pressed
  set per tick. Replay format: `{ formatVersion, gameVersion, seed, heroId, mode, inputs }`,
  validated with Zod.
- `simulate(replay, { maxTicks })` runs headless and returns `{ score, level, ticks, livesLeft,
hash }`, where `hash` is FNV-1a over a canonical serialization of the final state (integers and
  the raw bits of floats).
- Pros: ordinary floating-point code, readable and fast; the rules are mechanical and mostly
  enforced by the linter; verified by double simulation and cross-runtime tests.
- Cons: discipline is needed at every boundary (no `Date.now` sneaking in through a helper); float
  code can still diverge through non-associativity if two code paths compute "the same" value in
  different orders, so rules are written once and shared.

### B. Fixed-point integer simulation

All positions, speeds and timers are integers (for example 1/256 px units); no floats in the
world at all.

- Pros: determinism is structural; no reliance on IEEE semantics or linter discipline; trivially
  hashable state.
- Cons: every formula, config value and test has to think in fixed-point; conversions at the render
  boundary everywhere; overflow bookkeeping; a heavy tax for a benefit that option A already gets
  for the operations this game uses.

### C. Best-effort determinism, no server re-simulation

Keep physics on floats and frame deltas, verify scores on the server with plausibility checks only
(max score per second, max ticks).

- Pros: least work now.
- Cons: scores can still be forged; no golden-replay tests; no replay viewer; it removes the most
  interesting engineering story of the project (stage 8).

## Recommendation

**Option A** with `sfc32`. It is the industry-standard approach for lockstep and replay systems in
JavaScript games, it keeps the code ordinary, and the two things that break it (frame-dependent
time and non-deterministic math) are exactly what the engine loop and the ESLint rules already
remove.

## Decision

Option A: fixed 60 Hz ticks, floating point with restricted math, `sfc32` seeded through `splitmix32`. Decided by the owner on 2026-11-02.

## Consequences

- `packages/engine/src/math/` gets `rng.ts` (`sfc32`, `splitmix32`) and `trig.ts` (table-based
  `sin`/`cos`); `packages/game` imports only these.
- The world stores the RNG state; `createGame({ seed })` is the only way randomness enters.
- Tests: "seed X with inputs Y gives score Z and hash H after N ticks"; golden replays in
  `packages/game/fixtures/replays/`; a fast-check property that `simulate` twice yields one hash; a
  Node-versus-browser comparison once Playwright exists (stage 5).
- The CPU budget of the longest allowed replay is measured and recorded here before stage 8 relies
  on it.
- `gameVersion` in the replay must equal the version baked into the server function, otherwise the
  run is rejected and the client is told to reload.

## Amendment, 2026-11-12

Format version 2 (#155) adds `difficulty`: `{ formatVersion, gameVersion, seed, heroId, mode,
difficulty, inputs }`. Runs at different difficulties play different numbers and belong on
different boards, so the server must know which one it re-simulates. No replay of format 1 was
ever stored; `parseReplay` rejects it.

## Amendment, 2026-11-17

Format version 3 (#165) adds `daily`: `{ formatVersion, gameVersion, seed, heroId, mode,
difficulty, daily, inputs }`. It is the UTC date of a daily run as `YYYY-MM-DD`, or `null` for any
other run, as the `runs` table of stage 8 expects (`mode` there: `classic` or `daily`, with
`daily_date`). `parseReplay` rejects a daily replay whose seed is not `dailySeed(daily)`, so the
server checks the day's seed for free. A replay of format 2 reads as one of format 3 with
`daily: null`; the golden replays stay as they were recorded.

## Amendment, 2026-11-20

The CPU budget of the longest allowed replay, as the consequences above ask before stage 8 relies
on it (#218).

- **The limit.** `MAX_RUN_TICKS` in `@buzzkill/server` is 15 minutes of ticks (54,000). A whole
  campaign takes about 4.5 minutes, so the limit leaves three times that. A run that is not over by
  then is refused as unfinished; without a limit, a player who keeps dodging the queen could make
  the server play a run for as long as they like.
- **The cost.** The game was bundled with esbuild and run in a fresh Node 24 process for each
  measurement, seven times each, on the owner's laptop. Time is wall-clock time
  (`process.hrtime`): the simulation is single-threaded and does no I/O, and on Windows
  `process.cpuUsage` counts in steps of about 15.6 ms, too coarse for these numbers.

  | Run                                                                 | Ticks  | Time     |
  | ------------------------------------------------------------------- | ------ | -------- |
  | The golden campaign `campaign-easy-night-female-11`, parsed and won | 16,386 | 50–60 ms |
  | 15 minutes of the queen's rage, the hero sweeping and firing        | 54,000 | 35–41 ms |
  | 15 minutes of the campaign's waves, repeated, the hero never firing | 54,000 | 32–38 ms |

- **The budget.** The campaign, with its many enemies and shots, is the costliest per tick: about
  3.4 µs, including parsing and the compiler warming up. At that rate the limit costs 0.18 s; with
  three times that for a slower cloud CPU, 0.55 s of the 2 s an Edge Function may use (ADR-0007).
- **ADR-0007's figures.** Its 125 to 187 ms for the campaign came from `process.cpuUsage` and are
  too high for the reason above. Its conclusion holds with more margin.

## Amendment, 2026-11-20: the game version

`gameVersion`, which the server compares with its own before it plays a replay, was the release in
the root `package.json`. release-please changes it only when it tags a release, while every commit
to `main` is deployed (ADR-0010, ADR-0011). Two builds that play differently would then share a
version, and the server would refuse an honest replay as a forgery (#218).

- **The version.** `gameVersion()` of `@buzzkill/config` gives the release, then, as semver build
  metadata, the first 12 hex digits of a SHA-256 of the simulation's sources:
  `0.36.0+1f2e3d4c5b6a`. The sources are the `.ts` files of `packages/engine/src`, without its
  browser part, and of `packages/game/src`, without tests and benchmarks. Each file counts with its
  path and with its line endings made `\n`, so a checkout on Windows gives the version of one on
  Linux. It is at most 32 characters, as the `runs` table keeps it.
- **Who uses it.** The web build replaces `__GAME_VERSION__` with it (`vite.config.ts`), and the
  build of the Edge Function will bake it in the same way. Both compute it from the sources they
  are built from, so the function plays exactly the browser's replays when both come from one
  commit.
- **Why not the commit.** A commit hash would also tell builds apart, but every deploy would then
  send the open tabs a 409 and make them reload, even for a change to the menu, and no preview
  could submit to the backend. The hash of the sources changes with the simulation and only with
  it.
- **Old replays.** A replay keeps the version it was recorded with; the server refuses it once the
  simulation changes, as before. The replays already recorded carry a bare release and stay
  readable: `parseReplay` accepts any version of up to 64 characters.

## Amendment, 2026-11-21: how fast a player may submit runs

Re-simulation proves that a replay plays to its claim, not that anyone played it. A replay in
which the hero never moves verifies, costs a script nothing to make, and each stored run takes up
to 64 KiB of the free plan's 500 MB (ADR-0007). Anonymous accounts are free too (#235).

- **The limit.** No run plays faster than real time, at 60 ticks a second, and slower speeds
  (ADR-0014) only make the same ticks take longer. So the runs an honest player stored in the last
  hour hold at most an hour of ticks, plus the one run that began before the hour, which is at
  most `MAX_RUN_TICKS` (54,000, 15 minutes). A player's runs of the last hour may hold
  3,600 × 60 + 54,000 = 270,000 ticks; a run that would pass it is refused.
- **Where.** A `before insert` trigger on `runs` sums the player's last hour from an index. It
  takes an advisory lock on the player first, so requests sent together cannot all pass the check
  before any is counted. It refuses with the SQL state `PT429`, which PostgREST answers as HTTP 429, and
  the hint holds the seconds until enough of the hour's oldest runs have left it.
- **The answer.** The function answers 429 `too-many-runs` with `Retry-After`, which CORS exposes
  to the web app; the offline queue (#220) waits that long.
- **What it does not stop.** A script still stores 270,000 ticks an hour per account, about 177
  idle runs of a few hundred bytes each: about 0.1 MB an hour, which the owner can see and act on.
  One account playing in two tabs at once could reach the limit honestly; a 429 then only delays
  its runs. The server still plays a replay before the database refuses it, which costs CPU but
  not storage.
- **Rejected: a fixed number of runs a day.** It is simpler, but a fixed count either stops a keen
  player who loses many short runs or lets a script store as many long idle ones.
