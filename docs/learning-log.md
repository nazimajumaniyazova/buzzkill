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

## Stage 5 — App shell

_Completed on 2026-11-10 with release v0.13.0. The three answers are the owner's; the STAR drafts
below are facts gathered from the pull requests of the stage (#115 to #128): nine pull requests and
six releases (v0.9.0 to v0.13.0) over two days, and the tests of the repository grew from 495 to 841._

### What did I learn?

### What was hard?

### What would I do differently?

### STAR stories

#### ADR-0006: State management of the application shell

- **Situation:** In the 2023 code the flow of the screens was spread over a `choice === null`
  switch in `App`, a loading phase in the game session and dialogs that the HUD rendered from the
  game's status. Stage 5 needed a menu, a hero select, a run that pauses and ends, settings that
  survive a reload and a change of format, and later a loading and an error screen. The
  candidates were XState 5 with its React binding (15.9 kB gzip), `@xstate/store` (4.1 kB), a
  machine of our own, and Zustand with its persist middleware for the settings.
- **Task:** Model the flow and the settings so that impossible states cannot be written, the flow
  can be tested as a table, and the 150 kB gzip budget of the shell stays untouched.
- **Action:** A typed state machine of our own, chosen by the owner. `AppState` and `AppEvent`
  are discriminated unions and `transition` is one pure function; a store module of 50 lines and a
  15-line hook over `useSyncExternalStore` hold it. The tests check every allowed transition,
  every pair of state and event that must change nothing, invariants over random sequences of
  events with fast-check, and that the Mermaid diagram in `docs/architecture.md` draws exactly the
  transitions of the table. The settings use the same store with a versioned Zod schema, a
  migration of the old theme key and a fallback per field; the HUD subscribes one selector per
  value.
- **Result:** No dependency added. The machine grew during the stage without a rewrite: `boot`
  gave way to `loading` when the game moved into a chunk of its own (#112), and `failed` came with
  the error boundary (#113). It ends the stage with 8 states, 14 events and 128 tests, and each
  change was caught by the completeness checks of the table and by the diagram test. The settings
  gained the motion and the game speed without a new schema version. In ten seconds of play, 32
  HUD changes make 32 React commits and no render of `App`, `GameView` or `GameHud` (#109).

#### ADR-0013: Internationalization of the shell

- **Situation:** The shell had about 80 strings for the player, two languages and no
  translators. `@vitejs/plugin-react` 6 compiles with Oxc and has no Babel step. The candidates
  were i18next with react-i18next (up to 25 kB gzip), Lingui 6 (a 4 kB runtime, but its macros
  bring Babel back into the build) and a typed dictionary of our own.
- **Task:** Translate every string, make a missing translation a compile error, format numbers,
  percentages and plurals per language with `Intl`, switch the language without a reload, and keep
  hard-coded text from coming back.
- **Action:** A dictionary of our own, chosen by the owner. The English file is the source of
  truth and its type is the type of every dictionary; the Russian one declares that type as its
  return type, so a missing key, an extra key and a message with other parameters all fail to
  compile. A message with values is a function over `Intl.NumberFormat` and `Intl.PluralRules`.
  One object per language keeps the React context stable, so the render budget of the HUD holds.
  Three guards keep the text in the dictionary: ESLint rejects text between tags and string
  literals in the props that reach the player, a pseudo-language test renders every screen with
  every string marked and fails on a letter outside the marks, and a test fails when a Russian
  string equals the English one outside a short list.
- **Result:** 111 entries per language when it landed and 127 at the end of the stage (113
  strings and 14 messages, the announcements for screen readers among them), each new one added in
  both languages under the same checks. The main chunk grew by 3.1 kB gzip (97.07 to 100.15 kB),
  where a library would have cost up to 25 kB. The language starts as the browser's and is a
  setting under the versioned schema.

#### ADR-0014: Game speed and the leaderboard

- **Situation:** The in-game accessibility of #114 asked for a slower game. The simulation is
  deterministic: fixed 60 Hz ticks, replays that record the input of each tick, and a server in
  stage 8 that will verify a record by simulating its replay again. A slower game is easier, and
  the server cannot know the pace a run was played at.
- **Task:** Offer slower paces without touching the simulation, and decide how they meet the
  leaderboard.
- **Action:** The pace lives in the shell. `pacedHost` wraps the frame host of the engine's loop
  and gives it a clock that runs at 100, 75 or 50 % of real time, so the loop runs the same ticks
  with the same `dt`, further apart. A test runs a game at 50 % until the tick that a game at
  100 % reached and compares the two results, hash included. The run carries its speed from the
  settings. Of three options for the leaderboard (only 100 % in the global top, one top with the
  speed shown, a top per speed), the owner chose the first: slower runs will count as personal
  records.
- **Result:** No line of `packages/engine` or `packages/game` changed, and the golden replays
  stayed as they were. The pacing is a module of 28 lines and one multiplication per frame, and the
  whole of #114 (the announcements, the motion setting and the game speed) added 0.86 kB gzip to
  the main chunk. The rule waits for stage 8, written down with its limit: like any pace on a
  client, the speed a record reports cannot be proven.
