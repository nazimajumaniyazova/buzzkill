# ADR-0012: Benchmarks in CI

- **Status:** Accepted
- **Date:** 2026-11-05
- **Deciders:** Nazima Jumaniyazova

## Context

The engine and the game have benchmarks (`pnpm bench`): the collision broad phase at 50, 200 and
1000 entities, one simulation tick at steady load, a three-minute run and `simulate` on the golden
replays. Issue #44 asks CI to compare a pull request's benchmarks with `main` and to fail when
something gets more than 20 % slower, with noise handled.

Noise is the hard part. GitHub's shared runners vary by 10 to 20 % between runs of the same code,
which is the size of the regression to catch. Under Vitest, imports between modules also go
through getters of Vite's module runner, so absolute numbers are about four times those of the
bundled game; a comparison stays valid only because both sides pay the same overhead.

## Options

### A. CodSpeed

A hosted service, free for public repositories. `@codspeed/vitest-plugin` (6.0.0 and later
support Vitest 5) runs the existing `*.bench.ts` files; in CI, `CodSpeedHQ/action` measures them
under CPU simulation, counting instructions and modeling caches instead of timing wall-clock.

- Pros: the measurement does not depend on the runner, so a 20 % threshold is reliable; a report
  comment and a status check on every pull request; a history per benchmark; per-benchmark
  thresholds; no comparison code to maintain.
- Cons: an external service (its GitHub App, its dashboard, its availability); CPU simulation
  models a CPU, it does not run one, so its numbers are relative, not milliseconds; release 6.1.0
  already shifted Vitest 5 numbers once.

### B. Vitest's own baselines and a comparison script

Vitest 5 writes benchmark results to JSON (`writeResult`) and compares against a stored baseline
(`bench.from`). CI would run `main` and the pull request in the same job, several times each,
compare medians and comment.

- Pros: everything stays in the repository; no service and no app.
- Cons: wall-clock on shared runners, so a 20 % threshold needs repeated runs and still produces
  false alarms; more CI minutes; the comparison, the retries and the comment are ours to write and
  maintain.

## Recommendation

**Option A.** The point of the check is a threshold that can be trusted, and only CPU simulation
removes the runner's noise. The costs are an app installation and a dependency on a service whose
failure blocks nothing but this one check.

## Decision

Option A: CodSpeed in simulation mode. Decided by the owner on 2026-11-05.

## Consequences

- `@codspeed/vitest-plugin` is in the `nodeProject` preset of `@buzzkill/config`, the projects
  with benchmarks. Outside the CodSpeed runner it changes nothing, so `pnpm bench` works as before.
- `.github/workflows/codspeed.yml` runs `vitest bench` through `CodSpeedHQ/action` on pull
  requests, on pushes to `main` (the baseline) and on demand. It authenticates with OpenID
  Connect (`id-token: write`), so no token is stored in the repository's secrets.
- The owner installs the CodSpeed GitHub App for the repository, imports it on codspeed.io and
  sets the project's regression threshold to 20 % (the default is 10 %).
- After the first run on `main`, the "CodSpeed Performance Analysis" check joins the required
  checks of the "Protect main" ruleset; until then it reports without blocking.
- A benchmark's name is its identity in the history: renaming one starts a new series, so names
  change only on purpose.
- The absolute numbers come from the stage 9 measurements of the bundled game in
  `docs/performance.md`, not from CodSpeed or Vitest.
