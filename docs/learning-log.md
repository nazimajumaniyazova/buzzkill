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

## Stage 4 — Design system

_Completed on 2026-11-09 with release v0.8.0. The three answers are the owner's; the STAR draft
below is facts gathered from the pull requests of the stage (#86 to #104)._

### What did I learn?

### What was hard?

### What would I do differently?

### STAR stories

#### ADR-0005: Styling of the design system

- **Situation:** The 2023 game styled its menus with one global stylesheet and hard-coded colors.
  The new shell needed a day and a night theme that continue the game's own time of day, had to
  honor the user's contrast and motion preferences, and its colors had to reach the Canvas 2D
  renderer as well as React. The candidates were CSS Modules with custom properties,
  vanilla-extract and Tailwind 4.
- **Task:** Choose a styling approach with no runtime cost, typed class names, tokens readable
  from CSS and from TypeScript, and lint rules that catch a misspelled token before review.
- **Action:** CSS Modules plus custom properties. One TypeScript source defines the tokens in three
  layers, primitives, semantic and component, and every token keeps a reference to the one it is
  built on, so a theme changes 17 semantic colors and every component follows. A script renders
  `tokens.css` with the day theme on `:root`, the night theme under `data-theme` and under
  `prefers-color-scheme`, and overrides for `prefers-contrast: more` and `prefers-reduced-motion`;
  a test fails when the committed file is stale. `css-modules-kit` generates the class-name types,
  Stylelint rejects unknown custom properties and raw colors outside the token folder, and
  variants are `data-*` attributes rather than class combinations. Nine components and four
  primitives followed, on native elements wherever a WAI-ARIA pattern allowed it, each with a
  controlled and an uncontrolled mode, tests written first, axe in every test and every story.
- **Result:** 188 custom properties (62 primitives, 47 semantic, 79 component) in a 10 kB
  stylesheet, 1.9 kB gzipped, and no styling code at runtime. Both themes pass 25 WCAG AA contrast
  pairs in the token tests, and 6 more under `prefers-contrast: more`, text at 7:1. The package
  has 168 tests in 21 files and 55 stories that the a11y addon checks in Chromium on every pull
  request. The canvas drawing code reads the same tokens object as the components, so the HUD and
  the health bar take their colors from one source. The stage took 12 pull requests and 7 releases
  (v0.2.0 to v0.8.0) over two days.
