# ADR-0011: Changelog generation and release flow

- **Status:** Accepted
- **Date:** 2026-10-26
- **Deciders:** Nazima Jumaniyazova

## Context

Releases follow the milestones table (v0.1 … v1.0) with Semantic Versioning, a `vX.Y.Z` tag, a
GitHub Release and a `CHANGELOG.md` generated from Conventional Commits. Pull requests are squash
merged, so every commit on `main` is a PR title in Conventional Commits format. Packages are not
published to npm, so Changesets is out of scope.

## Options

### A. release-please (GitHub Action)

A bot keeps a "release PR" open that accumulates the changelog and version bump; merging it creates
the tag and the GitHub Release.

- Pros: the release is itself a reviewed PR, which matches GitHub Flow; changelog and release notes
  are consistent and automatic; nothing to run locally.
- Cons: tags created with the default `GITHUB_TOKEN` do not trigger other workflows, so the release
  workflow needs a fine-grained PAT or GitHub App token; the release PR must be rebased when `main`
  moves.

### B. git-cliff

A fast CLI that renders `CHANGELOG.md` from commit history using a template.

- Pros: fully customisable output; works locally and in CI; no bot.
- Cons: version bump, tagging and the GitHub Release are separate steps that we have to script
  ourselves in `release.yml`; another binary in the toolchain.

### C. commit-and-tag-version

Node CLI (maintained fork of standard-version) that bumps the version, writes the changelog and
tags in one local command.

- Pros: simplest; one `pnpm release` command.
- Cons: releases happen from a developer machine, outside the PR flow; no release notes on GitHub
  without extra scripting.

## Recommendation

**Option A.** It keeps releases inside the same reviewed-PR flow as all other changes and
produces GitHub Releases for free; the token caveat is a one-time setup.

## Decision

Option A: release-please. Decided by the owner on 2026-10-26.

## Consequences

- `release-please-config.json` and `.release-please-manifest.json` at the root; `release.yml`
  workflow on pushes to `main`.
- `CHANGELOG.md` is generated and excluded from Prettier.
