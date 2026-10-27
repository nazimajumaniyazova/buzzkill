# Contributing

Buzzkill is a solo portfolio project, but it is run like a team repository: every change goes
through an issue, a short-lived branch and a reviewed pull request. This page is the short
version of the rules; the tooling enforces most of them.

## Getting started

Requirements: Node.js 24 LTS (see `.nvmrc`) and pnpm. The exact pnpm version is in the
`packageManager` field of `package.json`; `corepack enable` or `npm install -g pnpm` both work.

```bash
pnpm install        # also installs the git hooks
pnpm dev            # web app on http://localhost:5173
pnpm build          # every package, through Turborepo
pnpm typecheck      # tsc --noEmit in every package
pnpm lint           # ESLint, Stylelint, Sherif, Knip, dependency-cruiser, CSpell
pnpm format:check   # Prettier
```

`pnpm lint` runs ESLint, Stylelint, Sherif, Knip, dependency-cruiser and CSpell; `pnpm lint:fix`
applies the autofixes. `pnpm test` arrives with the test tooling.

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
- Scopes: `engine`, `game`, `ui`, `web`, `config`, `deps`, `repo`, `release`.
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

## Architecture decisions

Significant decisions are recorded in `docs/adr/` (context, options, decision, consequences).
Decisions marked for the owner in the project plan are taken by the owner; contributors and AI
agents prepare the ADR draft with options and a recommendation, then wait.
