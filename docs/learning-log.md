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

## Stage 6 — Assets

_Completed on 2026-11-12 with release v0.17.0. The three answers are the owner's; the STAR drafts
below are facts gathered from the pull requests of the stage (#136 to #149): nine pull requests and
four releases (v0.14.0 to v0.17.0) over three days, and the tests of the repository grew from 841 to 969._

### What did I learn?

### What was hard?

### What would I do differently?

### STAR stories

#### ADR-0015: Where the game's art and sounds come from

- **Situation:** The inventory of #136 found that nothing the game shipped could be published: 11
  files, 1.50 MB, downloaded for the 2023 team project from sources nobody recorded. The heroes, the
  background and the first day enemy were placeholders, because their 2023 art was drawn by other
  members of the team or was over 1 MB (the two backgrounds weighed 1.14 and 1.62 MB). A search of
  the CC0 sources covered the sounds, the shots and the explosions well, but had no hero with a
  jetpack, no night insect with a flying animation and no vector city of the future, and the packs
  that came close mixed flat, glossy and pixel styles.
- **Task:** Give every image and sound a known source and a license that allows publishing, in
  one style, without changing the hitboxes, the muzzle or the explosion timing that the rules and
  the golden replays depend on.
- **Action:** The owner asked whether the art could be drawn for the project. A sample answered it:
  the six kinds of sprite drawn as vector code in the game's frame sizes, rendered in a browser next
  to the best CC0 candidates, by day and by night. Of three options (CC0 packs as the plan
  proposed, own art with synthesized sounds, own art with CC0 sounds), the owner chose the third. A
  new package, `@buzzkill/art`, draws each sprite as a pure function from its frame to an SVG
  document, and its tests check every frame against the sizes of the game configuration. The shot,
  the hit and the explosion come from Kenney's Sci-fi Sounds and Impact Sounds, downloaded by the
  owner. `ASSETS.md` lists every shipped file with its source and license, and a test fails when a
  file has no row.
- **Result:** The 11 files of unknown license left the repository. The art is 974 lines of
  TypeScript in seven modules that import nothing: six enemies, two heroes, two explosions, the shot
  and the city by day and by night, 61 sprite frames and 9 city layers in all. The three sounds
  weigh 44.7 kB together. The golden replays did not change during the stage, because the art is
  drawing only.

#### ADR-0016: The asset pipeline

- **Situation:** The art was now SVG drawn as code, and the sounds three Ogg Vorbis files of 7 to
  28 kB. The plan asked for atlases, WebP or AVIF, Opus or Ogg with a fallback and a typed
  manifest. The target browsers, Vite's defaults, all decode WebP, but AVIF needs Safari on macOS 13
  or later. Rasterizing SVG in the browser is uneven across engines, and Safari before 18.4 does not
  decode Ogg at all. No audio encoder was installed.
- **Task:** Turn the sources into files that look the same in every browser and play in every
  target browser, generate a manifest the drawing code is typed against, and let CI tell that the
  output is out of date without depending on the encoder build of each platform.
- **Action:** Of three options for the sprites (resvg and sharp at build time, the browser at load
  time, Playwright's Chromium at build time) and two for the sounds (the Ogg files as downloaded
  with WAV fallbacks, Opus with MP3 encoded by ffmpeg), the owner chose resvg and sharp, and the
  Ogg files with WAV. The engine's loader gained a `fallbackUrl` that it tries only when a file
  downloads but does not decode. A `pnpm assets` script renders every frame, packs the atlases,
  writes the WAV files with a JavaScript Vorbis decoder and generates the manifest that replaced
  the hand-written `GAME_ASSETS`. The manifest records a hash of each output's input and settings;
  CI recomputes the hashes without rasterizing.
- **Result:** 61 frames in two WebP atlases (239 and 128 kB) and 9 city layers of 5 to 11 kB, 437
  kB of images. The WAV files weigh 193 kB and download only where the Ogg file does not decode.
  No AVIF was needed, and the game ships none of the three tools' code. The build fails when the
  images and sounds pass 1 MB, and `pnpm lint` fails on a tracked file over 1 MB (#149). In stage
  7 the same script took the power-ups, the queen, Sam and Leo, and the images and sounds ended at
  967 of the 1,000 kB.

## Stage 7 — Gameplay, game feel and progress

_Completed on 2026-11-19 with release v0.34.0, the v0.3 milestone. The three answers are the
owner's; the STAR drafts below are facts gathered from the pull requests of the stage (#166 to
#211): 26 pull requests and 18 releases (v0.18.0 to v0.34.0) over eight days, and the tests of the
repository grew from 969 to 1460._

### What did I learn?

### What was hard?

### What would I do differently?

### STAR stories

#### ADR-0017: Levels and the end of a run

- **Situation:** A run was one endless level with the 2023 pace (an enemy every 1.7 s, then every
  0.4 s from the twentieth second on), won above 100 points. The player picked day or night in the
  hero select, and the replay stored the choice. `RunResult.level` was always 1. The plan asked
  for levels as data with a change of day and night, and did not say how that change fits the
  player's choice or how a run ends once there are levels. The second answer also shapes the boss,
  the daily challenge and the server's re-simulation in stage 8.
- **Task:** Describe the levels as data, keep the hero select and the replay format, and give a
  run an end that a boss, a daily seed and a server can rely on.
- **Action:** Of three options for each question, the owner chose that the player picks the first
  level's time and the level data says when it changes, and that a run is a campaign of six
  levels. `LEVELS` gives each level its waves (a count, the ticks between enemies, optional
  weights over the time's three enemies), a calm before each wave, a speed factor and whether the
  time changes after it. A level ends when its waves are sent and no enemy is left. The simulation
  reports `levelCleared` and `levelStarted`, and the state hash covers the level, the wave and the
  time of day. The screen between levels holds the game like a pause, so those ticks are never
  simulated and the replay does not depend on how long the player waits. An amendment of
  2026-11-13 lets a level end with the queen.
- **Result:** Six levels, 14 waves and 170 enemies, with the pace growing from an enemy every
  1.5 s to one every 0.43 s and their speed by a quarter. The queen ends the third level with 60
  hits and the sixth with 100. The hero select and the replay format stayed as they were, and
  `RunResult.level` became the level reached without a change to its shape. The golden replays
  changed once for this decision (#166). Tests play short campaigns of their own to reach the end
  of a level without the levels before it.

#### ADR-0018: The music, its source and its budget

- **Situation:** #161 asked for music that explosions duck, and the game had none: the 2023 music
  was of unknown source and was left behind. The images and sounds weighed 919 kB of their 1 MB
  budget, and a looping track of one or two minutes weighs a megabyte or more even as Ogg.
  OpenGameArt, the largest source of CC0 music, refused automated requests.
- **Task:** Find a track that is free to ship, play it without delaying the first frame or taking
  the budget of what the first frame needs, and keep every tracked file under 1 MB.
- **Action:** Of three options for the track and two for the budget, the owner chose a loop from
  the Music Loop Bundle by Abstraction (CC0, 2026-11-17) and a music budget of its own, 3 MB. The
  mixer streams the music from a media element through its music group, so the volume setting
  applies, and each explosion ducks it to 40 % in 50 ms, holds it for 0.25 s and brings it back in
  0.5 s. The shell plays it during a run and between its levels: a pause holds its place, a hidden
  page silences it, the end of a run starts it over, and the menu downloads none of it. The owner
  picked "Pixel War 1", a 53 s loop of 1.42 MB, and ffmpeg re-encoded it as Ogg Vorbis and as AAC
  for the browsers without Ogg.
- **Result:** The Ogg file weighs 0.79 MB and decodes to exactly as many samples as the pack's
  file, 2,352,154, so the loop keeps its length; the AAC copy weighs 0.87 MB. The music takes 1,658
  of its 3,000 kB, the images and sounds stayed at 967 kB, and the main chunk stayed at 101.31 kB
  gzip. The AAC copy has not yet been heard in a browser that needs it, such as Safari.

## Stage 8 — Backend

_The code of the stage was complete on 2026-11-28, before the hosted Supabase project and the
Umami account exist: the deploy, the GitHub link and the balancing numbers wait for them. The three
answers are the owner's; the STAR drafts below are facts gathered from the pull requests of the
stage (#224 to #269): 34 pull requests and 10 releases (v0.35.0 to v0.44.0) over nine days, and
the tests of the repository grew from 1460 to 1831._

### What did I learn?

### What was hard?

### What would I do differently?

### STAR stories

#### ADR-0007: The backend

- **Situation:** The plan's stage 8 gives the game boards of verified records: a record counts only
  when the server plays its replay again with the same `@buzzkill/game` as the browser and finds
  the same score and state hash (ADR-0009). The plan named Supabase, Firebase and an API of our own
  on Cloudflare Workers. A full campaign of 16,386 ticks took 125 to 187 ms of CPU in a fresh Node
  process on the owner's laptop, and a run cannot be cut short from outside.
- **Task:** Choose a backend whose function can play a whole run within its CPU limit, with SQL
  migrations, Row Level Security, generated types and anonymous accounts that can be linked to
  GitHub later.
- **Action:** Of the three options, the owner chose Supabase on the free plan (2026-11-20): 2 s of
  CPU per request on every plan, against 10 ms on the free plan of Workers and a card for
  Firebase. The work that followed:
  - `packages/server` verifies a submitted run by playing it again. It refuses a stale game
    version, a daily run of a day other than today or yesterday and a run past 15 minutes, and logs a run that plays to
    another result as suspicious.
  - The submit-run Edge Function is an esbuild bundle of it. The game version is the release plus
    a hash of the simulation's sources, so the browser and the function prove they play the same
    code.
  - The database has versioned migrations and Row Level Security in which only the function writes
    a run, an hour of play per hour per player (429 beyond it), nickname rules shared with the
    client, a view of each player's best run per board and a function that merges achievements.
    pgTAP tests them in CI, and a smoke test plays runs through the function on a local stack.
  - The client loads supabase-js on demand, starts an anonymous session only when a run is sent,
    and queues runs in `localStorage` until the server has them. It reads the boards with TanStack
    Query in a chunk of their own, and plays any stored replay, also from its link.
- **Result:** Measured as wall-clock time in a fresh process, the campaign plays again in 50 to
  60 ms and the longest allowed run in about 0.18 s, a tenth of the 2 s limit. The game stays
  fully playable offline and signed out, which an end-to-end test checks with every request to
  the backend blocked. The main chunk grew from 101.3 kB to 110.4 kB gzipped, as Vite reports it,
  against a budget of 150 kB; supabase-js (57.8 kB gzipped) and the boards (13 kB) download only
  when they are used. The deploy
  workflow is unproven until the owner creates the hosted project.

#### ADR-0019: Analytics without cookies

- **Situation:** To balance the game, the project needs to know where players lose, without
  cookies or personal data. The plan named Plausible and Umami, each in the cloud or self-hosted.
  The game reported a blow to the hero, but not what struck it, and the page had no content
  security policy.
- **Task:** Count six aggregated events, with the level and the cause of a death, send nothing
  under Do Not Track or Global Privacy Control, and allow the analytics domain and nothing more.
- **Action:** Of three options (Umami Cloud's free plan, Plausible's Business plan at $19 a month,
  counters of our own in Supabase), the owner chose Umami Cloud in the EU region (2026-11-24).
  - Each event is one `fetch` from the game's own code, with no script of another site and no
    cookie. The website id exists only in production builds, and both privacy signals are read
    once when the page starts.
  - `playerHit` gained its cause, an enemy's id, a sting or the queen's charge, without changing
    the simulation or the golden replays.
  - The build writes a `connect-src` policy into the page from its own environment: its origin,
    its Supabase project and the Umami host. It is a meta tag rather than a header, as an amendment
    of 2026-11-25 explains, and an end-to-end test plays a run under it.
- **Result:** The analytics module and its wiring cost 0.5 kB gzipped in the main chunk. The README
  says what is counted and that nothing personal is. The balancing section waits for the account
  and its first numbers.
