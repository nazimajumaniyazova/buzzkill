# ADR-0001: Monorepo tooling

- **Status:** Accepted
- **Date:** 2026-10-26
- **Deciders:** Nazima Jumaniyazova

## Context

Buzzkill is split into a React shell (`apps/web`), a reusable 2D engine (`packages/engine`), the game
domain (`packages/game`), a design system (`packages/ui`) and shared configs (`packages/config`).
The dependency rules between them must be enforced, not just documented: `engine` and `ui` must not
know about the game or React, `game` may depend only on `engine`.

Constraints: one developer, CI on GitHub Actions free minutes, Storybook for `ui` later, a headless
`@buzzkill/game` that must also run in Deno (Supabase Edge Functions, stage 8). The package manager
is pnpm in every option below (strict `node_modules`, workspaces, catalogs for single versions).

## Options

### A. pnpm workspaces + Turborepo

Turborepo adds a task graph (`build` depends on `^build`), local caching keyed by inputs, and
`--affected` to run only what a PR touched.

- Pros: boundaries enforced by pnpm (a package cannot import what it does not declare); CI skips
  unchanged packages and replays cached outputs; `turbo.json` is about ten lines; the de facto
  standard in the React/Vite ecosystem, so it reads well on a CV.
- Cons: one more tool and mental model (cache inputs, `outputs`, env hashing); a stale cache can
  hide a broken build if `inputs` are misconfigured; remote cache needs a Vercel account (optional).

### B. pnpm workspaces only

`pnpm -r --filter` runs scripts in topological order without any orchestrator.

- Pros: zero extra dependencies; nothing to learn beyond pnpm.
- Cons: no caching, so every CI run rebuilds, typechecks and tests all five packages; no notion
  of "affected"; task ordering and parallelism are hand-written in `package.json` scripts and grow
  with every package.

### C. Nx

Nx offers the same task graph and cache plus code generators, a project graph UI and plugins.

- Pros: the most mature affected/caching implementation; inferred targets for Vite/Vitest/Storybook.
- Cons: heavier configuration surface (`nx.json`, plugin options), frequent plugin churn, and most of
  its value (generators, module federation, distributed execution) is irrelevant for one developer
  and five packages. Hard to justify in two paragraphs.

### D. Single package with folders and path aliases

- Pros: simplest possible setup, one `package.json`.
- Cons: boundaries exist only as lint rules; per-package test environments (`node` for the
  simulation, `jsdom` for UI) need workarounds; `@buzzkill/game` cannot be consumed by the Edge
  Function as a package; the architecture is not visible from the repository layout.

## Recommendation

**Option A.** It gives real package boundaries and fast CI for the price of a ten-line config, and
it is the setup most React teams use today, which matters for interviews.

## Decision

Option A: pnpm workspaces + Turborepo. Decided by the owner on 2026-10-26.

## Consequences

- `pnpm-workspace.yaml` with `catalog:` entries so React, TypeScript, Vitest and ESLint have one
  version across the repository.
- `turbo.json` declares `build`, `typecheck`, `test`, `lint`, `dev`; CI runs `turbo run ... --affected`.
- Remote cache stays off until measurements show CI time is a problem.
- Dependency rules are checked twice: by pnpm (undeclared imports fail) and by dependency-cruiser
  (forbidden directions fail).
