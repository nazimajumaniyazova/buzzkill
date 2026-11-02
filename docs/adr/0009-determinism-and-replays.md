# ADR-0009: Determinism and replays

- **Status:** Proposed (awaiting owner decision)
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

_Pending owner decision._

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
