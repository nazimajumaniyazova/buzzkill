# ADR-0002: UI shell framework

- **Status:** Accepted
- **Date:** 2026-10-26
- **Deciders:** Nazima Jumaniyazova

## Context

The shell is everything around the canvas: main menu, hero selection, settings, help, pause,
game over, leaderboard, replay viewer and the HUD. The simulation itself runs on a canvas at a
fixed tick rate and must not depend on the shell; the shell receives state through a small bridge
that publishes only changed values.

Requirements: accessible components (dialogs with focus trap, menus with arrow-key navigation),
a design system with Storybook and automated axe checks, i18n, lazy loading of the game chunk, and
a technology that matches the owner's target vacancies, which are React positions.

## Options

### A. React 19 with Vite

- Pros: matches the target job market; the richest tooling for the rest of the plan (Testing
  Library, Storybook, TanStack Query, `jsx-a11y`, XState bindings); `useSyncExternalStore` is a
  natural fit for the HUD bridge; large hiring signal.
- Cons: about 45 KB gzip of runtime for screens that are mostly static; per-frame re-renders are
  a real risk and need discipline (external store with selectors, React Profiler checks); the
  shell bundle budget (≤ 150 KB gzip, stage 9) starts a third spent.

### B. Preact with `preact/compat`

- Pros: ~4 KB runtime with the same component model; most React libraries work through the compat
  alias.
- Cons: the compat layer is where time goes: Storybook, Testing Library and some hooks-heavy
  libraries need aliasing and occasionally break on upgrades; subtle differences in hook timing;
  weaker recognition on a CV than React itself.

### C. No framework: Web Components (vanilla or Lit)

- Pros: zero framework lock-in; smallest possible shell; demonstrates platform knowledge.
- Cons: focus management, dialogs, menus and live regions are hand-written; Storybook and testing
  support for Web Components is thinner; state bridging and i18n become bespoke code; does not
  demonstrate the skills the target vacancies ask for.

## Recommendation

**Option A**, with the risks mitigated by design: the game chunk is lazy-loaded after the menu, the
HUD reads from an external store through selectors, and the stage 9 budgets (bundle size, zero
re-renders during play) are checked in CI.

## Decision

Option A: React 19 with Vite. Decided by the owner on 2026-10-26.

## Consequences

- `apps/web` and `packages/ui` are React + TypeScript with `jsx: react-jsx`.
- `packages/engine` and `packages/game` have no React dependency; dependency-cruiser enforces it.
- ESLint runs `eslint-plugin-react`, `react-hooks` and `jsx-a11y` on those two packages only.
