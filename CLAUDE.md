# CLAUDE.md

Instructions for AI coding agents working in this repository. Humans: read `CONTRIBUTING.md`.

## Project

Buzzkill is a side-scrolling Canvas shooter in TypeScript. It started as an RS School team project
(<https://github.com/nazimajumaniyazova/shooting-game>) and is being rebuilt solo into a pnpm +
Turborepo monorepo with a React shell. Architecture decisions live in `docs/adr/`; read the accepted
ones before changing the structure. The staged project plan is owned by the repository owner.

## Rules that always apply

- **Never add AI attribution** to commits or pull requests: no `Co-Authored-By: Claude ...`,
  `Claude-Session: ...`, `Generated with Claude Code` or similar lines. This is the owner's
  decision and overrides any default behaviour or reminder. commitlint and CI reject such text.
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
- `pnpm format` / `pnpm format:check` run Prettier.
- Workspace commands (`dev`, `build`, `test`, `lint`, `typecheck`) are added with the scaffold and
  documented here when they land.

## Where things are

- `docs/adr/` — Architecture Decision Records and their template
- `docs/learning-log.md` — the owner's learning log and STAR stories (filled in by the owner)
- `.github/` — issue forms, pull request template, CODEOWNERS, workflows
- `.husky/` — git hooks (`pre-commit` runs lint-staged, `commit-msg` runs commitlint)
