# ADR-0006: State management of the application shell

- **Status:** Accepted
- **Date:** 2026-11-09
- **Deciders:** Nazima Jumaniyazova

## Context

Stage 5 builds the application shell in `apps/web`: the flow from boot through the menu, hero
select, playing, paused, level complete and game over (#107), the screens on the design system
(#108), the finished bridge from the game to React (#109), settings that survive a reload and a
change of format (#110), then i18n, lazy loading, an error boundary and in-game accessibility.
The plan's table of state layers (`docs/architecture.md`) gives every kind of state a home and a
tool, and leaves two tools to this decision: the finite state machine of the application flow,
and the store of the settings.

What is already fixed:

- React 19 with Vite 8 (ADR-0002). `useSyncExternalStore` is React's API for external stores,
  and the shell already uses it: `GameHud` subscribes to `game.subscribe` and reads
  `game.getHud()`, and the game publishes a new HUD object only when a value changes, at most once
  per frame (#40).
- The simulation state lives in `packages/game` as mutable typed arrays with no reactivity
  (ADR-0003). The shell talks to a run only through the `Game` object: `start`, `pause`, `resume`,
  `dispose`, `subscribe`, `getHud`, `replay` and `result`. The HUD carries `status` and `paused`,
  so a pause and a game over are observable from outside already.
- Today the flow is a `choice === null` switch in `App`, a `Phase` union in `GameSession`
  (loading, failed, ready) and the pause and game-over dialogs that `GameHud` renders from the
  HUD. The comments on these components say that the stage 5 machine replaces them.
- The flow is flat: seven states (`boot`, `menu`, `heroSelect`, `playing`, `paused`,
  `levelComplete`, `gameOver`) and about a dozen events (the player's choices; the game's paused,
  resumed, level complete and game over; assets loaded or failed; restart; quit). No state nests
  another and none run in parallel. Stage 7 adds levels, a boss and a daily challenge, which are
  still sequences of screens.
- Settings (#110): music and effects volume, theme, difficulty, key bindings and language. They
  persist in `localStorage` under a schema with a `version` and migrations. Zod 4 is in the
  catalog and already validates replays (ADR-0009). The theme choice of #75 lives in
  `localStorage` under `buzzkill.theme`, read and written by two small functions.
- The bundle budget of the shell is 150 kB gzip (ADR-0004); the main chunk is 85 kB.
- The code standards ask for discriminated unions for states and events, no `any` and
  `exactOptionalPropertyTypes`.
- The owner's target vacancies are React positions, where state machines, `useSyncExternalStore`
  and store libraries come up, and so does the judgment of when not to add a library.

Sizes below are minified and gzipped, from bundlephobia for the versions current on 2026-11-09.

## Options

Two choices. The options for the settings depend on the choice for the flow.

### Application flow

#### A. A typed state machine of our own

`AppState` and `AppEvent` are discriminated unions; `transition(state, event): AppState` is one
pure function, a `switch` over the state and the event, which is the transition table. A
`createStore(transition, initial)` of about thirty lines holds the current state and exposes
`getState`, `send` and `subscribe`; a `useStore(store, select)` hook wraps
`useSyncExternalStore`. Effects (creating and disposing a run, loading assets, applying the theme)
are React effects keyed on the state, or listeners of the store.

- Pros: no dependency; one subscription mechanism in the app, the one the HUD bridge already
  uses; the types are TypeScript's own, so a state that carries a `Game` exists only while playing
  or paused and a pause dialog on the menu cannot be written; the transition function is tested
  as a table, including the events that must change nothing; the same `createStore` serves the
  settings; it reads in review without knowing a library.
- Cons: no inspector and no diagram generated from the code, so the Mermaid diagram in
  `docs/architecture.md` is kept by hand; effects are coordinated by us instead of being declared
  next to the states; nested or parallel states would have to be built if they ever appear.

#### B. XState 5 with `@xstate/react`

A machine declared with `setup({ types, actions, guards, actors }).createMachine(...)`, run by
`createActor`, read in React with `useSelector`. `xstate` 5.33.4 is 14.5 kB, `@xstate/react` 6.1.0
is 1.3 kB.

- Pros: the standard statechart library: guards, actions, invoked actors and delayed events are
  declared next to the states; the Stately inspector and visualizer draw the machine from the
  code; nested and parallel states come for free; well known in interviews.
- Cons: 15.9 kB, a tenth of the budget and a fifth of the current chunk, for seven flat states; a
  second type system (`setup({ types })`, `assign`, actor logic) beside TypeScript's unions, with
  sharp edges under `exactOptionalPropertyTypes`; the actor model for effects sits beside React's
  effects, so there are two ways to run a side effect; the API changed deeply from v4 to v5.

#### C. `@xstate/store` 4

`createStore({ context, on: { event: (context, event) => ... } })` with `useSelector`; 4.1 kB.

- Pros: an event-driven store with typed events out of the box, a fraction of XState's size, the
  same inspector protocol.
- Cons: a store, not a state machine: there is one `context` and no finite state value, so
  impossible states are not excluded by the types unless a `status` discriminant is modeled by
  hand, and then the library adds little over option A; still a dependency and a second
  subscription style.

### Settings store

#### A. The same `createStore`, a versioned Zod schema and `localStorage`

The settings are a Zod object with a literal `version`. `load()` reads `localStorage`, runs the
migrations from the stored version to the current one (one pure function per step), parses with
the schema and falls back to the defaults when anything fails; `save()` writes on every change.
The store is the `createStore` of the machine with a reducer of setting changes, and
`useSettings(select)` subscribes.

- Pros: one mechanism for the three client layers (flow, HUD bridge, settings); the migrations
  are explicit and tested as pure functions; validation happens at the trust boundary, as it does
  for replays; no dependency.
- Cons: persistence, selectors and the `storage` event for other tabs are our code, about sixty
  lines, and ours to keep.

#### B. Zustand 5 with the `persist` middleware

`create(persist(..., { name, version, migrate }))`, with Zod in `merge`. `zustand` 5.1.0 is 0.5 kB
for the core and about 1 kB more for the middleware.

- Pros: the de-facto store for React; `persist` already has `version` and `migrate`; selectors
  with `useShallow`; devtools; widely known.
- Cons: `persist` does not validate what it reads, so Zod has to be wired into `merge` and the
  fallback written anyway; a second subscription API beside the `useSyncExternalStore` of the HUD
  bridge, two idioms for one job; the value of the dependency, the hook ergonomics, is thirty
  lines in option A.

#### C. Jotai 3 with `atomWithStorage`

One atom per setting, persisted individually. `jotai` 3.0.2 is 3.3 kB.

- Pros: granular subscriptions per setting without selectors.
- Cons: no version and no migration, so a schema change means our migration code anyway; six
  settings do not need an atom graph; a third idiom.

## Recommendation

**A and A.** The flow is flat and small, and the guarantee the plan asks for, impossible states
made unrepresentable, is a property of discriminated unions and one transition function, not of a
library. The shell already subscribes through `useSyncExternalStore`, so a thirty-line store gives
the machine and the settings the same mechanism as the HUD and adds nothing to the bundle.
XState's strengths, nested and parallel states and the inspector, pay for themselves once a
machine outgrows a table; the transition table written here is the input to that migration if
stage 7 ever needs it, in one ADR. Zustand would be the right store beside XState, where writing a
store by hand next to a large library would be odd; beside our own machine it duplicates the
primitive.

## Decision

Option A for the application flow and option A for the settings: a typed state machine and a
store of our own, Zod for the settings schema. Decided by the owner on 2026-11-09.

## Consequences

- **Where it lives.** `apps/web/src/state/`: `machine.ts` with `AppState`, `AppEvent` and
  `transition`; `store.ts` with `createStore` and the `useStore(store, select)` hook;
  `settings/` with `schema.ts` (Zod, `version`), `migrations.ts`, `storage.ts` and the settings
  store. The pure modules import nothing from React, so they test under the node environment.
- **Testing.** `transition` is tested as a table: every allowed transition, and for every state
  the events that must leave it unchanged. A property test (`fast-check`, in the catalog) sends
  random event sequences and checks the invariants: a `Game` exists only in `playing` and
  `paused`, `gameOver` follows `playing` only. Migrations are tested from a fixture per version;
  the fallback is tested with garbage, a wrong version and a missing key.
- **Effects.** React effects keyed on the state name create and dispose a run, load the assets
  and apply the theme; the machine holds no timer and no promise. The game's `subscribe` feeds the
  machine: changes of `paused` and `status` become events, so the pause handling that `GameHud`
  does today moves into the machine (#107, #109).
- **The bridge (#109).** `game.getHud()` stays the external store of the HUD, and the selector
  hooks sit on the same `useSyncExternalStore`. No new store for it.
- **Settings (#110).** The `buzzkill.theme` key of #75 becomes a field of the settings object; the
  first migration, version 0 to 1, lifts the bare theme string into it. The game reads the volumes
  and the bindings from the settings store when a run starts; a change during a run applies
  through the `Game` where a method exists, otherwise at the next run.
- **Documentation.** The flow is drawn as a Mermaid state diagram in `docs/architecture.md` next
  to the state layers table and updated with `transition`; a test checks that the diagram names
  every state.
- **Revisiting.** XState becomes worth its size if the flow gains nested or parallel states, or if
  an inspector is needed to debug it. That would be a new ADR superseding this one, with the
  transition table as its starting point.
- **Budget.** Nothing is added to the bundle; the shell stays at 85 kB until the screens of #108.
