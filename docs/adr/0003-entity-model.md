# ADR-0003: Entity model of the simulation

- **Status:** Accepted
- **Date:** 2026-11-02
- **Deciders:** Nazima Jumaniyazova

## Context

The 2023 engine models the game with classes: `Game` owns arrays of `Player`, `Enemy1..3`,
`EnemyNight1..3`, `Projectile` and two explosion classes, smoke and fire. The six enemy classes differ
only in numbers and sprites; every projectile and explosion is a fresh allocation; update order is
whatever the class methods happen to call; nothing can be tested without a canvas, `Image` and
`Audio`. The characterization tests of stage 2 pin this behavior.

Stage 3 needs: enemies and levels as data; object pools with no allocation per tick; a fixed,
explicit update order (ADR-0009 needs it for determinism); pure rule functions (collision
response, damage, score) that run headless in Node and in a Supabase Edge Function; and a size
that one person can hold in their head. Scale is small: tens of entities, hundreds with particles,
benchmarks at 1000.

## Options

### A. ECS-lite, hand-written

Entities are integer ids. Components are plain stores (one typed array or array per field, indexed
by id) owned by a `World`. Systems are functions `(world, context) => void` called in a fixed list
every tick: spawn, input, movement, shooting, collision, damage, lifetime, score. Enemy kinds are
config objects (`satisfies EnemyConfig[]`) that a spawn system turns into components.

- Pros: pools fall out of id recycling; no per-tick allocation; the system list _is_ the update
  order; every system is a pure function over data and trivially testable; data-driven enemies,
  levels and bonuses (stage 7) need no new classes; a ~200-line `World` with no dependency.
- Cons: more indirection than a class per thing: readers must learn ids, stores and queries; easy to
  over-engineer (archetypes, bitmask queries) if discipline slips; a hand-written world has no
  community behind it (an off-the-shelf one like `bitecs` or `miniplex` would, at the cost of a
  dependency whose iteration order and allocation behavior would need auditing for ADR-0009).

### B. Composition of objects with behaviors

Each entity is an object with `transform`, `sprite`, `health` and a list of behavior objects
(`SineMovement`, `Shooter`, `Lifetime`) created by factories from config.

- Pros: closest to how most front-end developers already think; data-driven kinds through
  factories; incremental migration from the current classes is easy.
- Cons: one object plus a behaviors array per entity means allocation on spawn unless every type
  gets its own pool; the update order is per entity, so cross-entity logic (collisions, spatial
  hashing) sits awkwardly outside the model; behaviors reach into each other's state.

### C. Keep the current classes, clean them up

Collapse the six enemy classes into one with a config, pool projectiles and explosions, keep the
rest.

- Pros: least work; the characterization tests keep passing almost unchanged.
- Cons: inheritance stays the extension mechanism; `Game` keeps owning everything; update order
  stays implicit; headless simulation still needs `Image`/`Audio` stubs; every stage 7 feature
  (bonuses, boss phases, particles) would add classes and `instanceof` checks.

## Recommendation

**Option A**, hand-written and deliberately minimal: a `World` with fixed-capacity stores and a
free list, components as plain fields, no archetypes, no query DSL. It is the only option where
pools, fixed order, pure rules and data-driven content are properties of the structure instead
of conventions to remember.

## Decision

Option A: a hand-written, minimal ECS-lite. Decided by the owner on 2026-11-02.

## Consequences

- `packages/game/src/world/` holds the `World`, component stores and the system list; entity ids
  are branded numbers; stores are sized by a `maxEntities` budget from the level config.
- Enemy kinds, bonuses and later bosses are data files validated with `satisfies`; day and night
  are two config sets.
- The characterization tests are rewritten against the new public API (`createGame`) and their
  expectations are revisited one by one; intentional behavior changes are listed in the PR.
- Benchmarks (`*.bench.ts`) cover one tick at 50/200/1000 entities so the data layout can be
  challenged with numbers.
