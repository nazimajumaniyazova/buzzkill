# ADR-0005: Styling approach for the design system

- **Status:** Accepted
- **Date:** 2026-11-08
- **Deciders:** Nazima Jumaniyazova

## Context

Stage 4 builds the design system in `packages/ui`: design tokens in three layers generated from
one TypeScript source (#74), the `day` and `night` themes plus the `prefers-color-scheme`,
`prefers-reduced-motion` and `prefers-contrast` preferences (#75), about a dozen accessible React
components, Storybook with the a11y addon, and axe on every component. This ADR decides how the
styles of those components are written and how the tokens reach them.

What is already fixed:

- React 19 with Vite 8 (ADR-0002). Vite 8.3 handles `*.module.css` with no configuration
  (`css.transformer` defaults to PostCSS modules) and minifies CSS with Lightning CSS, which is a
  regular dependency of Vite. The repository has no PostCSS configuration.
- Stage 1 configured Stylelint with `stylelint-config-standard`, `stylelint-config-css-modules` and
  `declaration-strict-value`: outside `packages/ui/src/tokens`, colors, spacing, radii and z-index
  may only be `var(--…)` references. The shell's `index.css` already follows that with five
  temporary variables that this stage replaces.
- The canvas draws placeholder art and HUD colors from hard-coded hex strings in
  `apps/web/src/game/draw-game.ts`. Issue #74 asks that the renderer read the active tokens
  without React. `packages/game` cannot import `ui` (architecture rule), `apps/web` can.
- The hot loop rule: nothing is allocated per frame, and the HUD updates up to 60 times a second.
  Styles must therefore be static at runtime; CSS-in-JS with a runtime (styled-components,
  Emotion) is excluded up front and is not an option below.
- The shell bundle budget is 150 kB gzip (ADR-0004, measured in stage 9); the main chunk is 85 kB.
- The owner's target vacancies are React positions, where CSS Modules and Tailwind are the two
  approaches most often named.

Baseline CSS in 2026 covers what preprocessors used to add: nesting, `color-mix()`,
`light-dark()`, `@property`, container queries and `:has()`. No option below needs Sass.

## Options

### A. CSS custom properties as tokens, CSS Modules for components

The token source is a TypeScript object; a generator writes `tokens.css` (`:root { --color-… }`
and the theme blocks) and the TypeScript types of the token names. Each component has a
`*.module.css` file that uses only `var(--…)` values; variants are `data-*` attributes set from
typed props (`data-size="md"`, `data-tone="danger"`), so no class strings are built at render.
Class names are typed with `@css-modules-kit` (1.4.1, TypeScript 6 supported): its language
service plugin for the editor, its `cmk` code generator for `tsc` and CI, and its Stylelint plugin.
Token names in CSS are checked with `stylelint-value-no-unknown-custom-properties` (6.1.1) against
the generated `tokens.css`.

- Pros: no runtime and no dependency in the bundle, the CSS ships as CSS; nothing to add to Vite,
  Vitest or Storybook; the Stylelint rules of stage 1 apply as they are; tokens are real custom
  properties, so a theme switch is one attribute on `<html>` and the cascade does the rest; the
  same TypeScript object that generates the CSS gives the canvas its colors, no DOM reads in a
  frame; semantic class names make the structure of the design system visible in Storybook and
  DevTools; the skills it exercises (the cascade, custom properties, modern selectors) are the
  ones asked about in interviews.
- Cons: the type safety is bolted on: without the code generator a misspelled class is a runtime
  bug, and without the Stylelint rule a misspelled token silently falls back; variants are
  selectors written by hand (`[data-size='md']`) and the component's props must list the same
  values, which a test has to check; nothing detects CSS that no component uses except the
  Stylelint plugin of `@css-modules-kit`; two generated artifacts (`tokens.css`, the `*.d.ts`
  files) must stay fresh, so CI needs a staleness check.

### B. vanilla-extract

Styles are written in `*.css.ts` files and compiled to static CSS at build time: `createTheme`
and `createThemeContract` for tokens and themes, `style()` for rules, `recipe()` for variants.
`@vanilla-extract/css` 1.21.3 (October 2026) and `@vanilla-extract/vite-plugin` 5.2.6 support
Vite 8.

- Pros: tokens, themes and styles are TypeScript end to end, so a misspelled token or class is a
  compile error and the two themes are forced to define the same contract; `recipe()` types the
  variants against the props; the output is still static CSS with custom properties and no
  runtime; the token object is a plain object the canvas can read.
- Cons: a build-time dependency that evaluates `.css.ts` files in a child compiler, which every
  tool has to run: the Vite plugin, the same plugin in Vitest, Storybook through the Vite builder;
  slower dev-server start and HMR than plain CSS; Stylelint does not read `.css.ts`, so the stage 1
  rules (tokens only, no hex) must be rebuilt as ESLint rules; emitted class and variable names are
  hashed, which makes DevTools and Storybook harder to read unless debug ids are set; a smaller
  community and a small core team, with the Vite 8 plugin release following Vite 8 by months;
  less recognizable on a CV than CSS Modules or Tailwind.

### C. Tailwind CSS 4

Tokens are declared in CSS in an `@theme` block, which emits both the custom properties and the
utility classes; components compose utilities in JSX, with a variant helper such as `cva` or
`tailwind-variants`. Tailwind 4.3.5 (November 2026) and `@tailwindcss/vite` support Vite 8.

- Pros: the most widespread approach in React vacancies; tokens are custom properties by design, so
  the canvas reads them as in option A; the design is constrained to the token scale because a
  utility names a step, not a value; the `dark:`, `motion-reduce:` and `contrast-more:` variants
  map one to one onto the preferences of #75; the Prettier plugin sorts classes; Storybook needs
  only the stylesheet.
- Cons: the source of truth is the CSS `@theme` block, while #74 wants a TypeScript object, so one
  of the two is generated from the other anyway; variant helpers concatenate class strings at
  render, which is work on every HUD update unless memoized; arbitrary values (`bg-[#fff]`,
  `p-[13px]`) are an escape hatch that an ESLint plugin must close to keep the tokens-only rule,
  and the stage 1 Stylelint configuration becomes mostly moot because component styles live in
  TSX; long class lists in JSX hide the structure of a design system whose point, in this
  portfolio, is to show that structure in Storybook.

## Recommendation

**Option A.** It costs nothing at runtime and nothing in the bundle, the repository already
assumes it (the Stylelint rules of stage 1, the temporary variables in `index.css`, the plan's
own recommendation), and the tokens stay real custom properties that the shell switches with one
attribute and the canvas reads from the same TypeScript object that generated them. Its gaps have
tools: `@css-modules-kit` for typed class names, `stylelint-value-no-unknown-custom-properties`
for token names, a staleness check in CI for the generated files, and `data-*` variants typed by
the props. Option B buys compile-time safety with a build-time dependency in every tool and a
Stylelint setup to rebuild; option C buys familiarity with a second source of truth and class
strings built at render. Both would be reasonable; neither is needed.

## Decision

Option A: CSS Modules with custom properties as tokens. Decided by the owner on 2026-11-08.

## Consequences

- **Vite.** No change: `*.module.css` works as is, Lightning CSS minifies. Class names in CSS are
  written in camelCase so that `styles.primaryButton` reads without a `localsConvention`.
- **Typed class names.** `@css-modules-kit/ts-plugin` in the `tsconfig.json` of `ui` and `web`
  for the editor; `@css-modules-kit/codegen` generates `*.module.css.d.ts` before `tsc` in
  `pnpm typecheck` and in CI, and the generated files are git-ignored; its Stylelint plugin reports
  class names that no component uses.
- **Stylelint.** The stage 1 rules stay. `stylelint-value-no-unknown-custom-properties` is added
  with the generated `tokens.css` as its source, so a `var(--…)` that names no token fails lint.
  `packages/ui/src/tokens/**/*.css` stays the only place for literal values, and it is generated,
  never edited by hand.
- **Tokens and the canvas.** `@buzzkill/ui` exports the token object and a function that resolves
  the semantic colors of a theme to plain strings. `draw-game.ts` in `apps/web` replaces its
  `COLORS` with them, resolved once when the theme changes, never with `getComputedStyle` inside a
  frame. `packages/game` keeps knowing only `mode`.
- **Themes.** The shell sets `data-theme="day"` or `"night"` on `<html>`; the token CSS defines
  the semantic layer per theme. `prefers-color-scheme` chooses the default before the player
  chooses, `prefers-reduced-motion` zeroes the motion tokens, `prefers-contrast: more` swaps the
  semantic colors. Details and the storage of the choice are #75.
- **Storybook.** `@storybook/react-vite` 10.6 imports `tokens.css` once in its preview; a toolbar
  switches `data-theme`. No styling addon is needed.
- **Generated files in CI.** The token generator and `cmk` run in the Quality job; a diff after
  generation fails the job, as #74 requires.
- **Budget.** The stylesheet is a separate asset and joins the stage 9 bundle budget.
