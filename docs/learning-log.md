# Learning log

The owner's notes, written at the end of every stage of the project plan. The answers are the
owner's own words; whoever helps with the project only records them. They are the raw material for
interview stories.

Every stage answers three questions:

1. What did I learn?
2. What was hard?
3. What would I do differently?

Every accepted ADR gets a story draft in STAR format (Situation, Task, Action, Result), with numbers
where there are any. The drafts collect the facts of the decision; the owner rewrites them in her
own words before telling them.

## Stage 1 — Foundation

_To be filled in when the stage is complete._

### What did I learn?

### What was hard?

### What would I do differently?

### STAR stories

#### ADR-0001: Monorepo tooling

- **Situation:**
- **Task:**
- **Action:**
- **Result:**

#### ADR-0002: UI shell framework

- **Situation:**
- **Task:**
- **Action:**
- **Result:**

#### ADR-0010: Hosting and preview deploys

- **Situation:**
- **Task:**
- **Action:**
- **Result:**

#### ADR-0011: Changelog and releases

- **Situation:**
- **Task:**
- **Action:**
- **Result:**

## Stage 2 — Legacy import

_The stage had no ADR: it imported the 2023 engine with its history (24 commits, rewritten to
Conventional Commits with an "Imported from" trailer), quarantined it from the tooling, and pinned
its behavior with 32 characterization tests that were deleted again with the code in stage 3._

### What did I learn?

### What was hard?

### What would I do differently?

## Stage 3 — Engine refactor

_Completed on 2026-11-05 with release v0.1.0. The three answers are the owner's; the STAR drafts
below are facts gathered from the pull requests of the stage (#54 to #72)._

### What did I learn?

### What was hard?

### What would I do differently?

### STAR stories

#### ADR-0003: Entity model of the simulation

- **Situation:** The 2023 engine was classes: six enemy classes that differed only in numbers and
  sprites, a fresh allocation for every projectile and explosion, an update order that was whatever
  the methods happened to call, and nothing testable without a canvas, `Image` and `Audio`.
- **Task:** Rebuild the simulation so that it runs without a browser, allocates nothing per tick
  and updates in a fixed order, without taking on an ECS framework the game does not need.
- **Action:** A hand-written ECS-lite: entities are integer ids, every component is a typed array
  sized once, live ids sit in a dense list in spawn order, removals are deferred to the end of the
  tick and done by swap-remove. Eight systems run in a fixed order; enemies are two lists of three
  data configs validated with `satisfies`; a double loop replaced the spatial hash for collisions
  because the benchmark showed it faster below 200 entities.
- **Result:** The simulation runs in Node with no DOM. The package has 99 % statement coverage and
  property-based tests over whole runs. One tick at steady load costs 0.016 ms under Vitest, and a
  three-minute run of 10 800 ticks costs 89 ms when bundled. Enemies, heroes and rules are data, so
  stage 7 can add kinds and levels without new classes.

#### ADR-0004: Rendering technology

- **Situation:** The choice was between Canvas 2D and PixiJS (a WebGL scene graph). The first
  decision was PixiJS; it was reconsidered the same day, before any renderer code existed, and the
  history of that change is recorded in the ADR itself.
- **Task:** Draw tens of sprites at 60 FPS, stay inside the 150 kB gzip budget of the shell, and
  keep a path to WebGL if measurements ever call for it.
- **Action:** A `Renderer` interface in the engine with one implementation on Canvas 2D, typed
  against the part of the 2D context it uses so the engine core still compiles without the DOM lib.
  Off-screen sprites are culled, positions snap to whole device pixels, the backing store follows
  the device pixel ratio up to 2, and the canvas is letterboxed. The game never calls `drawImage`;
  the shell's drawing code reads the world through a port and interpolates between ticks.
- **Result:** No rendering dependency. The main chunk is 85 kB gzip against the 150 kB budget. A
  WebGL renderer would replace one file behind the same interface, and the ADR names the trigger
  for that: a frame above 8 ms on the reference desktop.

#### ADR-0009: Determinism and replays

- **Situation:** The leaderboard of stage 8 verifies a score by re-running the player's replay on
  the server. The 2023 code used `Math.random`, frame deltas from `requestAnimationFrame` and
  `Math.sin`, none of which gives the same result twice or on another machine.
- **Task:** Make the simulation a pure function of the seed and the inputs, bit-identical in every
  browser and in Node or Deno, with a replay small enough to store per run.
- **Action:** Fixed 60 Hz ticks with an integer tick counter; one seeded generator (`sfc32` seeded
  through `splitmix32`) as the only source of randomness; sine and cosine as the engine's own series
  after octant reduction; ESLint bans on `Math.random`, `Date.now` and the transcendental
  functions in the game package; a replay that stores only the changes of the pressed-action set,
  validated with Zod; an FNV-1a hash of the whole state, floats by their raw bits; golden replays
  and pinned scenarios whose results every pull request must keep or explain.
- **Result:** A property test replays up to 1500 ticks of random input twice and gets the same
  state; a run recorded through the browser path gives the same hash in `simulate`. A replay of a
  minute of play is about 100 numbers. Re-simulating a three-minute run costs about 0.1 s of CPU in
  Node, so a server function can afford to verify every submitted score.

#### ADR-0012: Benchmarks in CI

- **Situation:** GitHub's shared runners vary by 10 to 20 % between runs of the same code, which is
  the size of the regression the project wants to catch.
- **Task:** Fail a pull request that makes a benchmark more than 20 % slower, without false alarms
  and without maintaining a comparison script.
- **Action:** CodSpeed in CPU simulation mode, which counts instructions instead of timing
  wall-clock: a Vitest plugin in the shared preset, a workflow that authenticates with OpenID
  Connect instead of a stored token, six benchmarks covering collisions at three sizes, one tick, a
  three-minute run and `simulate`.
- **Result:** Every pull request gets a performance report and a status check against the baseline
  recorded on `main`. The timeouts had to grow because CPU simulation runs the three-minute
  benchmark for over two minutes, and the Vitest module runner makes absolute numbers about four
  times those of the bundled game, which is why the absolute budget is measured on the bundle.
