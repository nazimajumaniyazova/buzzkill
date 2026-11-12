# Contributing

Buzzkill is a solo portfolio project, but it is run like a team repository: every change goes
through an issue, a short-lived branch and a reviewed pull request. This page is the short
version of the rules; the tooling enforces most of them. For the map of the packages and the
runtime data flow read [docs/architecture.md](docs/architecture.md); for the reasoning behind the
structure read the [ADRs](docs/adr/README.md).

## Getting started

Requirements: Node.js 24 LTS (see `.nvmrc`) and pnpm. The exact pnpm version is in the
`packageManager` field of `package.json`; `corepack enable` or `npm install -g pnpm` both work.

```bash
pnpm install        # also installs the git hooks
pnpm dev            # web app on http://localhost:5173
pnpm build          # every package, through Turborepo
pnpm typecheck      # tsc --noEmit in every package; in ui, cmk first writes the *.module.css.d.ts
pnpm lint           # ESLint, Stylelint, Sherif, Knip, dependency-cruiser, CSpell
pnpm test           # Vitest, all projects; pnpm test:coverage adds coverage
pnpm test:storybook # every story in Chromium; once: pnpm --filter @buzzkill/ui exec playwright install chromium
pnpm storybook      # Storybook of the design system on http://localhost:6006
pnpm bench          # benchmarks of the engine and the game
pnpm assets         # regenerate the atlases, WAVs and asset manifest after changing art or a sound
pnpm format:check   # Prettier
```

`pnpm lint` runs ESLint, Stylelint, Sherif, Knip, dependency-cruiser and CSpell; `pnpm lint:fix`
applies the autofixes. `pnpm test` runs every Vitest project; `pnpm test:coverage` enforces the
80% thresholds of `engine` and `game`. `pnpm test:storybook` renders every story of `packages/ui`
in Playwright's Chromium, runs its play function and fails on an accessibility violation; it
needs the browser installed once (the command above) and runs in CI on every pull request. The
**Accessibility** page of that Storybook names the WAI-ARIA pattern of every component and walks
through each with the keyboard; a new component gets its pattern as the `docs.subtitle` of its
stories, a row on that page and an axe assertion in its test. `pnpm bench` runs the `*.bench.ts` files; in CI, CodSpeed
runs them on every pull request and fails the check when one gets slower than its threshold
(ADR-0012).

A new image or sound starts as a source: art in `packages/art`, or a downloaded file with its
license in `apps/web/assets-src`. `pnpm assets` then generates what the game loads (ADR-0016), and
the file gets a row in `ASSETS.md` with its source, author and license. The asset tests fail until
both are done.

Two size limits hold (#135, `docs/performance.md`): no file tracked by git over 1 MB, checked by
`pnpm lint`, and at most 1 MB of images and sounds in the game's build, checked by every
`pnpm build`, which prints the total. Make a file smaller before raising a limit; a raise needs a
pull request that says why.

## Workflow: GitHub Flow

1. Every task starts with an issue (typos and tiny chores are the exception). Use the issue forms
   and describe the acceptance criteria as a task list.
2. Branch from the current `main`: `<type>/<issue-number>-<short-kebab-description>`, for example
   `feat/12-object-pools`, `fix/27-touch-input-ios`, `docs/3-adr-monorepo`.
3. Keep the branch short-lived (a few days at most); split big tasks into several PRs.
4. Rebase on `main` before opening the PR (`git rebase main`, never merge `main` into the branch).
5. Open the PR, let CI pass, get it reviewed, squash merge. The branch is deleted automatically.
6. `main` always builds, passes the tests and is deployed.

## Commits: Conventional Commits 1.0

```
<type>(<scope>): <subject>

<body: why, not what; wrapped at 100 columns>

Closes #12
```

- Types: `feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `style`, `build`, `ci`, `chore`, `revert`.
- Scopes: `engine`, `game`, `ui`, `web`, `art`, `config`, `deps`, `repo`, `release`.
- Subject: imperative mood, lower-case first letter, no trailing period; the whole header is at
  most 72 characters.
- One commit is one logical change, and the project builds on every commit. No `wip`, `fix`,
  `update` or `minor changes`.
- Breaking changes to a package's public API: `!` after the type or a `BREAKING CHANGE:` footer.
- Tidy the history before opening the PR (`git commit --fixup` + `git rebase --autosquash`, or
  `git reset --soft` and recommit).
- Commits are signed (SSH signing, shown as "Verified" on GitHub).
- **No AI attribution.** Lines such as `Co-Authored-By: Claude ...`, `Claude-Session: ...` or
  `Generated with Claude Code` are not allowed in commits or PR descriptions. The `commit-msg`
  hook and CI reject them.

`commitlint` checks every message locally (Husky `commit-msg` hook) and in CI.

## Pull requests

- Title = the future squash commit header, in Conventional Commits format.
- Fill in the template: What, Why (with `Closes #N` and the ADR if any), How, Testing,
  Screenshots / GIF, Performance, Checklist.
- Aim for at most ~400 changed lines, excluding lock files and generated code.
- Unfinished work is a Draft PR. Review your own diff on GitHub before asking for review.
- Review comments are addressed with new commits; the history is not rewritten after review.
- The simulation is deterministic (ADR-0009), so its results are pinned: the golden replays in
  `packages/game/fixtures/replays/` and the scenarios in `packages/game/src/replay/`. A change
  that moves any of their scores, ticks or hashes says why under How and updates them with
  `pnpm vitest -u`. An unexplained change is a bug.

## Architecture decisions

Significant decisions are recorded in `docs/adr/` (context, options, decision, consequences).
Decisions marked for the owner in the project plan are taken by the owner; contributors and AI
agents prepare the ADR draft with options and a recommendation, then wait.

## Releases

Releases follow Semantic Versioning and the milestones of the project plan (v0.1 Playable, v0.2
Polished, and so on). release-please (ADR-0011) keeps a pull request titled `chore(release): x.y.z`
open against `main`: it accumulates the changelog from the Conventional Commits merged since the last
release and bumps `version` in `package.json`. Merging that pull request creates the tag `vx.y.z` and
the GitHub Release; nothing is released by hand and `CHANGELOG.md` is never edited by hand. Until 1.0,
breaking changes bump the minor version.

The action runs with the workflow's own `GITHUB_TOKEN`. Tags it creates do not trigger other
workflows, which is fine: production deploys come from the merge commit on `main`.

## Dependencies

Renovate opens update pull requests every Monday, grouped by tool (eslint, vitest, react, …), and
merges minor and patch updates of dev tooling itself once CI is green. New releases are proposed only
after three days in the wild. Major updates, and every TypeScript update, wait for a review. Do not
edit `pnpm-lock.yaml` by hand; `pnpm install` keeps it in sync with the catalog in
`pnpm-workspace.yaml`.
