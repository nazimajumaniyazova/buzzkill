import type { RadioOption } from '@buzzkill/ui';
import { createContext, type JSX, type ReactNode, use } from 'react';

import type { Language } from '../state/settings/schema';
import { type Dictionary, en, type Messages } from './en';
import { createFormat, type Format } from './format';
import { ru } from './ru';

/** One language: its strings and the formatters of its locale (ADR-0013). */
export interface I18n {
  readonly language: Language;
  readonly t: Messages;
  readonly format: Format;
}

/**
 * Each language as it names itself, the same in every language, so a player who cannot read the
 * current one still finds their own.
 */
export const LANGUAGE_NAMES: Readonly<Record<Language, string>> = {
  en: 'English',
  ru: 'Русский',
};

const DICTIONARIES: Readonly<Record<Language, Dictionary>> = { en, ru };

/** The strings and the formatters of `language`, built once with its locale. */
export function createI18n(language: Language, dictionary = DICTIONARIES[language]): I18n {
  const format = createFormat(language);
  return { language, t: dictionary(format), format };
}

// Built once per language, so the context value of a language is always the same object and a
// change of the settings other than the language re-renders no consumer.
const BY_LANGUAGE: Readonly<Record<Language, I18n>> = {
  en: createI18n('en'),
  ru: createI18n('ru'),
};

/** The i18n of `language`; the same object on every call. */
export function i18nFor(language: Language): I18n {
  return BY_LANGUAGE[language];
}

const I18nContext = createContext<I18n>(BY_LANGUAGE.en);

/** Gives the screens below the strings of one language. English without a provider. */
export function I18nProvider({
  i18n,
  children,
}: {
  readonly i18n: I18n;
  readonly children: ReactNode;
}): JSX.Element {
  return <I18nContext value={i18n}>{children}</I18nContext>;
}

/** The strings and the formatters of the current language. */
export function useI18n(): I18n {
  return use(I18nContext);
}

/** Radio options for `values` in their order, each labelled from `labels`. */
export function labelled<T extends string>(
  values: readonly T[],
  labels: Readonly<Record<T, string>>,
): RadioOption<T>[] {
  return values.map((value) => ({ value, label: labels[value] }));
}
