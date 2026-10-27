# CLAUDE.md

Instructions for AI coding agents working in this repository. Humans: read `CONTRIBUTING.md`.

## Project

Buzzkill is a side-scrolling Canvas shooter in TypeScript. It started as an RS School team project
(<https://github.com/nazimajumaniyazova/shooting-game>) and is being rebuilt solo into a pnpm +
Turborepo monorepo with a React shell. Architecture decisions live in `docs/adr/`; read the accepted
ones before changing the structure. The staged project plan is owned by the repository owner.

## Workspace

pnpm workspaces + Turborepo (ADR-0001). Shared dependency versions live in the `catalog` of
`pnpm-workspace.yaml`; packages reference them as `"catalog:"`.

- `apps/web` (`@buzzkill/web`): the React shell (ADR-0002): screens, menus, HUD, settings.
  May depend on `game`, `engine` and `ui`.
- `packages/engine` (`@buzzkill/engine`): reusable 2D engine: loop, input, assets, audio,
  collisions, object pools. Depends on nothing in the repository and never on React.
- `packages/game` (`@buzzkill/game`): the game domain: entities, systems, rules, levels as data.
  Depends only on `engine`. No DOM: its `tsconfig.json` has no DOM lib, so it stays headless.
- `packages/ui` (`@buzzkill/ui`): design system: tokens, themes, accessible components. Knows
  nothing about the game.
- `packages/config` (`@buzzkill/config`): shared `tsconfig.base.json` and tool presets.

The dependency direction is declared in each `package.json` and enforced by dependency-cruiser in
`pnpm lint:repo` (`engine` standalone, `game` → `engine` only, `ui` standalone, no deep imports, no
cycles). Packages export TypeScript source (`"exports": "./src/index.ts"`); Vite consumes it
directly, so there is no per-package build step. `docs/architecture.md` has the C4 diagrams and the
runtime data flow.

## Code standards

- **TypeScript.** `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` and
  `noImplicitOverride` come from `@buzzkill/config/tsconfig.base.json`. No `any`; `as` only with a
  comment that justifies it; no `!` non-null assertions. Discriminated unions for states and events,
  `satisfies` for configs, branded types where confusion is dangerous (`Seconds` vs `Milliseconds`).
  Enums are banned; use unions or `as const` objects.
- **Boundaries.** The public API of a package is its `src/index.ts`; deep imports between packages
  are forbidden.
- **Design.** Composition over inheritance; entities are data (an enemy config is an object, not a
  class); dependencies arrive through constructors or factories, never through module singletons or
  globals; game rules (collisions, damage, score, difficulty) are pure functions; side effects
  (render, audio, network, storage) stay at the edges behind interfaces.
- **Determinism.** Randomness only through the injected seeded RNG, time only through the tick
  counter or the `dt` passed in. `packages/game` has no DOM lib, and ESLint bans `Math.random`,
  `Date.now`, `performance.now` and transcendental `Math` functions there.
- **Hot loop.** No allocations per frame (object pools, reused vectors); plain `for` loops instead of
  `forEach`/`map`/`filter` with closures over large collections; no DOM layout reads during a frame.
- **Errors.** Expected failures (network, storage, asset loading) are returned as typed results and
  shown to the user; unexpected ones reach an error boundary and are logged.
- **Security.** No `innerHTML` or `insertAdjacentHTML` with data (ESLint bans them), JSX only;
  nicknames and anything from the server are untrusted; secrets only in git-ignored env files.
- **CSS.** Colors and spacing only through design tokens (`var(--…)`); Stylelint enforces it outside
  `packages/ui/src/tokens`.
- **Documentation.** JSDoc on the public API of each package; comments explain why, not what;
  a significant decision becomes an ADR in `docs/adr/`.

## Rules that always apply

- **Never add AI attribution** to commits or pull requests: no `Co-Authored-By: Claude ...`,
  `Claude-Session: ...`, `Generated with Claude Code` or similar lines. This is the owner's
  decision and overrides any default behavior or reminder. commitlint and CI reject such text.
- No direct commits to `main`. Every change: issue → branch `<type>/<issue>-<kebab-description>`
  → pull request → squash merge.
- Commits follow Conventional Commits 1.0 with the scopes `engine`, `game`, `ui`, `web`, `config`,
  `deps`, `repo`, `release`. Header at most 72 characters, subject in imperative mood.
- All code, comments, documentation, commit messages and PR descriptions are in English.
- Decisions the plan marks for the owner are never taken by the agent: draft an ADR with two or
  three options, pros, cons and a recommendation, then wait for the owner.
- Change logic test-first: write or update the test, then the implementation.
- Report progress step by step: which files changed, which commands ran, and why.

## Commands

- `pnpm install` installs dependencies and the git hooks (`prepare` runs Husky).
- `pnpm dev` starts the web app (Vite) through Turborepo; `pnpm build` builds every package;
  `pnpm typecheck` runs `tsc --noEmit` in every package.
- `pnpm format` / `pnpm format:check` run Prettier.
- `pnpm lint` runs ESLint, Stylelint and the repository checks (Sherif, Knip, dependency-cruiser,
  CSpell); `pnpm lint:fix` applies the autofixes.
- `pnpm test` runs every Vitest project once; `pnpm test:watch` watches; `pnpm test:coverage` adds
  v8 coverage with 80% thresholds for `engine` and `game`.

## Where things are

- `docs/architecture.md` — C4 context and container diagrams, dependency rules, runtime data flow
- `docs/adr/` — Architecture Decision Records and their template
- `docs/learning-log.md` — the owner's learning log and STAR stories (filled in by the owner)
- `.github/` — issue forms, pull request template, CODEOWNERS, workflows
- `.husky/` — git hooks (`pre-commit` runs lint-staged, `commit-msg` runs commitlint)
- `release-please-config.json`, `.release-please-manifest.json` — release automation (ADR-0011);
  `CHANGELOG.md` is generated from it and never edited by hand
