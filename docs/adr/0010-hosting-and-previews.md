# ADR-0010: Hosting, production and preview deploys

- **Status:** Accepted
- **Date:** 2026-10-26
- **Deciders:** Nazima Jumaniyazova

## Context

Every pull request needs a preview deployment whose URL is posted to the PR automatically; `main`
deploys to production. Later stages run Playwright (stage 5) and Lighthouse CI (stage 9) against the
preview URL and require custom HTTP headers for a strict Content Security Policy (stage 10).
The repository is currently private.

## Options

### A. Vercel (Hobby plan)

- Pros: preview per PR with a bot comment out of the box; production from `main`; headers and
  redirects in `vercel.json`; first-class Vite and Turborepo support, including an optional remote
  cache from the same vendor; works with private repositories.
- Cons: Hobby plan is for non-commercial use only; another vendor account to maintain; the deploy
  runs on Vercel, not in GitHub Actions, so the CI workflow has to wait for Vercel's status check
  before running e2e tests.

### B. Netlify (Starter plan)

- Pros: deploy previews with PR comments; headers in `netlify.toml`; the team project already used
  Netlify, so the owner knows the dashboard.
- Cons: 300 build minutes per month on the free plan (a monorepo with Storybook eats them fast);
  weaker monorepo detection than Vercel; otherwise equivalent lock-in.

### C. GitHub Pages via GitHub Actions

- Pros: no third-party account, the whole deploy is one workflow file in the repository.
- Cons: no preview deployments (would need a hand-rolled scheme of per-PR subfolders or a second
  repository); no custom response headers, so CSP can only be a weaker `<meta>` tag; requires a
  public repository on the Free plan; base-path handling in Vite.

## Recommendation

**Option A.** Preview-per-PR with a comment and real response headers are hard requirements of this
plan, and only options A and B provide them; Vercel's free build allowance and Turborepo integration
tip the balance.

## Decision

Option A: Vercel. Decided by the owner on 2026-10-26.

## Consequences

- The owner creates the Vercel project and connects the GitHub repository (one-time, ~5 minutes).
- `apps/web` gets a `vercel.json` with headers; stage 10 tightens the CSP there.
- The `ci.yml` e2e job waits for the Vercel preview check and uses its URL.
