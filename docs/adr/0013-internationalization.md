# ADR-0013: Internationalization of the shell

- **Status:** Accepted
- **Date:** 2026-11-09
- **Deciders:** Nazima Jumaniyazova

## Context

Plan stage 5, item 6 (#111): the shell speaks English and Russian, every string for the player
is extracted, and the language is a setting (#110) with the browser's language as the default.
The acceptance criteria add three things: a lint or a test fails on a hard-coded string, the
language switches at runtime without a reload with `lang` on the document following, and
plurals, numbers and dates are formatted per language with `Intl`. The plan leaves the library to
the owner: `i18next`, `@lingui` or a minimal typed dictionary of our own.

What is already fixed:

- The shell and the HUD hold about 80 strings for the player, six of them with a value in them
  (a score, a key, an action). Plurals arrive with the screen-reader announcements of #114 and
  dates with the leaderboard of stage 8.
- Two languages, written by the owner and the helper; no translators and no translation
  platform.
- The settings already store `language: 'en' | 'ru'` under the versioned Zod schema of #110,
  and the shell reads the settings through `useSyncExternalStore` (ADR-0006).
- The bundle budget of the shell is 150 kB gzip (ADR-0004); the main chunk is 97 kB.
- `@vitejs/plugin-react` 6 compiles with Oxc and has no Babel step.
- `eslint-plugin-react` 7.37, already installed, has `react/jsx-no-literals`, which reports text
  between JSX tags whatever the library.
- The code standards ask for strict types, no `any` and `exactOptionalPropertyTypes`, and
  ADR-0006 already chose a small typed module of our own over a library for a small problem.

Sizes below are minified and gzipped, for the whole package, from bundlephobia for the versions
current on 2026-11-09.

| Package              | gzip    |
| -------------------- | ------- |
| i18next 27.0.1       | 14.9 kB |
| react-i18next 18.0.1 | 10.2 kB |
| @lingui/core 6.12.0  | 2.4 kB  |
| @lingui/react 6.12.0 | 1.8 kB  |

## Options

### A. i18next with react-i18next

Resources per language as JSON, `t('menu.play')` through the `useTranslation` hook.

- Pros: the most common i18n stack in React vacancies. Keys are typed through
  `CustomTypeOptions`. Plurals go through `Intl.PluralRules`, and numbers and dates have built-in
  formatting. Dictionaries can load lazily.
- Cons: up to 25 kB gzip for 80 strings, a quarter of the budget left. The compiler does not
  check that the Russian resources are complete without a type written by hand. Keys are strings
  like `'menu.play'` instead of plain code.

### B. Lingui 6

Messages in ICU MessageFormat, the source text as the key through macros, catalogs extracted to
PO files and compiled ahead of time.

- Pros: ICU MessageFormat, and PO catalogs suit translators. Messages are compiled ahead of time,
  so the runtime is about 4 kB.
- Cons: the macros need Babel. `@vitejs/plugin-react` 6 dropped Babel, so it would come back
  through `@rolldown/plugin-babel` next to Oxc. A CLI to extract and compile catalogs and a build
  step join the project. For two languages and no translators that infrastructure hardly pays
  off.

### C. A typed dictionary of our own

The English file is the source of truth and its shape is the type of every dictionary. The
Russian one is declared with that type, so a missing key or a wrong parameter fails to compile.
A message with a value is a function over `Intl.PluralRules`, `Intl.NumberFormat` and
`Intl.DateTimeFormat`. A hook reads the language from the settings of #110, and `lang` on the
document follows.

- Pros: no dependency and about 1 kB of code. The strictest completeness check of the three.
  The same approach as ADR-0006: no library for a small problem.
- Cons: no ICU and no catalogs for translators. The plural helper is ours to write. Many
  languages or translators would call for a move to Lingui; the message functions translate into
  ICU almost one to one.

## Recommendation

C. With 80 strings and two languages, what matters here is a complete translation and correct
forms through `Intl`. The compiler checks completeness more strictly than A or B, and the budget
is not spent. A is reasonable if the portfolio should show i18next, the most common stack in
vacancies; it is only larger.

## Decision

C, a typed dictionary of our own, chosen by the owner on 2026-11-09.

## Consequences

- `apps/web/src/i18n/` holds the dictionaries and the React side. `en.ts` returns the English
  messages from the formatters of its locale; its return type is `Messages`, and `Dictionary` is
  `(format: Format) => Messages`. `ru.ts` is a `Dictionary` whose function declares `Messages` as
  its return type, so the compiler reports a missing key, an extra key and a message with other
  parameters. Messages with several values take one object, so a translation names what it uses.
- `format.ts` creates the `Intl` formatters of a locale once: numbers, whole percentages, long
  dates and the plural form of a word, with `other` as the fallback category. No screen shows a
  date yet; the daily challenge (stage 7) and the leaderboard (stage 8) are the first to.
- `i18n.tsx` builds one `I18n` object (language, messages, formatters) per language, once, so the
  context value changes only with the language and no other settings change re-renders its
  consumers. `useI18n()` reads it; without a provider it is English, so a component renders on
  its own in a test or a story. `App` gives the provider the language of the settings and sets
  `document.documentElement.lang`.
- The default language is the first of `navigator.languages` the game speaks, matched on the
  primary subtag, else English. `parseSettings` and `loadSettings` take the player's defaults, so
  a missing or broken language falls back to the browser's too. Migration 0 now moves only the
  theme and leaves every other field to those defaults. Settings saved by 0.10.0 already hold a
  language, English unless the player changed it, and keep it.
- Each language is named in its own words in the language switch, whatever the current language.
- The guard has three layers. ESLint runs `react/jsx-no-literals` and a `no-restricted-syntax`
  list for string literals in props that reach the player (`label`, `title`, `aria-label` and
  others), in the `label`, `title` and `description` fields of objects, and in conditions between
  tags, over `apps/web/src` except the dictionaries and the tests. A pseudo-language test renders
  every screen and dialog with every dictionary string marked and fails on a letter outside the
  marks, which catches what the lint cannot see. A test fails when a Russian string equals the
  English one, apart from a listed few that stay the same on purpose.
- Rich text is avoided: a sentence with key caps inside became a list of action and keys, like
  the rest of the help. A future message with markup inside needs a helper with slots.
- Both dictionaries ship in the main chunk: 111 entries each, more than the 80 strings counted
  above because the names of keys and gamepad buttons joined them. The main chunk grows from
  97.07 kB to 100.15 kB gzip. Loading a language on demand can wait until there are more of them.
- CSpell checks the English text only. The Russian dictionary for CSpell is GPL-3.0, so Cyrillic
  is skipped in `apps/web/src` and the Russian text is reviewed by a native speaker.
- The design system takes every text through props; the shell passes the translated close label
  to `Dialog`. `packages/ui` stays without a dictionary.
