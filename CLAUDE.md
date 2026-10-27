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

The dependency direction is declared in each `package.json` and will also be enforced by
dependency-cruiser (issue #3). Packages export TypeScript source (`"exports": "./src/index.ts"`);
Vite consumes it directly, so there is no per-package build step.

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

- `docs/adr/` — Architecture Decision Records and their template
- `docs/learning-log.md` — the owner's learning log and STAR stories (filled in by the owner)
- `.github/` — issue forms, pull request template, CODEOWNERS, workflows
- `.husky/` — git hooks (`pre-commit` runs lint-staged, `commit-msg` runs commitlint)
