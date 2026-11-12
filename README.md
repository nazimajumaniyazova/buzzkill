# Buzzkill

[![CI](https://github.com/nazimajumaniyazova/buzzkill/actions/workflows/ci.yml/badge.svg)](https://github.com/nazimajumaniyazova/buzzkill/actions/workflows/ci.yml)
[![CodSpeed](https://img.shields.io/endpoint?url=https://app.codspeed.io/badge.json)](https://app.codspeed.io/nazimajumaniyazova/buzzkill)

A side-scrolling Canvas shooter in TypeScript. Defend the city from an alien insect swarm, day and night.

[![Play Buzzkill](https://img.shields.io/badge/%E2%96%B6%20Play-Buzzkill-2ea44f?style=for-the-badge)](https://buzzkill-nazimajumaniyazovas-projects.vercel.app)
[![Storybook](https://img.shields.io/badge/Storybook-design%20system-ff4785?style=for-the-badge&logo=storybook&logoColor=white)](https://buzzkill-storybook.vercel.app)

Arrow keys or W and S to move, Space or J to shoot, Escape or P to pause; a gamepad works too.
Production is deployed from `main` on Vercel; every pull request gets its own preview deployment.
The Storybook of the design system is deployed the same way, from `packages/ui`.

Started as a team project at RS School: https://github.com/nazimajumaniyazova/shooting-game.
The game engine was written by me; since then the project has been rebuilt and extended solo.

**Status:** the 2023 game is rebuilt on a new engine; the first release, v0.1, is next.

## How it is built

- **A headless, deterministic simulation.** `@buzzkill/game` runs at a fixed 60 ticks per second
  with a seeded RNG and no DOM, so the same seed and inputs give the same result bit for bit, in
  the browser and in Node ([ADR-0009](docs/adr/0009-determinism-and-replays.md)). Replays store
  only input changes, and golden replays pin the rules in the tests.
- **ECS-lite.** Entities are ids, components are typed arrays, systems run in a fixed order and
  enemies are data, not classes ([ADR-0003](docs/adr/0003-entity-model.md)).
- **A small engine of its own.** `@buzzkill/engine`: fixed-step loop, action-based input for
  keyboard, touch and gamepad, asset loader, a Canvas 2D renderer behind an interface
  ([ADR-0004](docs/adr/0004-rendering.md)), a Web Audio mixer, collisions and pools.
- **A React shell.** `apps/web` loads assets, wires the engine to the game and shows the HUD
  through `useSyncExternalStore`, so a 60 Hz game never re-renders React 60 times a second
  ([ADR-0002](docs/adr/0002-ui-shell.md)).
- **Guard rails.** Strict TypeScript, dependency rules enforced in CI, 99 % test coverage with
  property-based tests, and benchmarks compared with `main` on every pull request
  ([ADR-0012](docs/adr/0012-benchmarks-in-ci.md)).

## Documentation

- [Architecture](docs/architecture.md): C4 diagrams, dependency rules between the packages, runtime
  data flow, what exists today.
- [Architecture Decision Records](docs/adr/README.md): the decisions and the alternatives rejected.
- [ASSETS.md](ASSETS.md): the source, author and license of every file the game ships.
- [Assets](docs/assets.md): every image and sound the game uses, how the files are made and the
  2023 files they replaced.
- [Contributing](CONTRIBUTING.md): how to run the project locally and how changes get in.
- [Security policy](SECURITY.md) and [Changelog](CHANGELOG.md).
