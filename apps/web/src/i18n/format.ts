/**
 * The forms of a word by the plural category of a count (CLDR, `Intl.PluralRules`). English
 * needs `one` and `other`; Russian `one`, `few`, `many` and `other` (1 файл, 2 файла, 5 файлов,
 * 1,5 файла). A category the language never selects can be left out; `other` is the fallback.
 */
type PluralForms = Readonly<Partial<Record<Intl.LDMLPluralRule, string>>> & {
  readonly other: string;
};

/** Numbers, plurals and dates in the conventions of one language, all through `Intl` (ADR-0013). */
export interface Format {
  /** 1234 → "1,234" in English, "1 234" in Russian. */
  readonly number: (value: number) => string;
  /** A fraction as a whole percentage: 0.3 → "30%" in English, "30 %" in Russian. */
  readonly percent: (fraction: number) => string;
  /** A calendar date: "November 9, 2026" in English, "9 ноября 2026 г." in Russian. */
  readonly date: (date: Date) => string;
  /** The form of a word that goes with `count`. */
  readonly plural: (count: number, forms: PluralForms) => string;
}

/** The formatters of `locale`, created once; `Intl` objects are costly to create and cheap to use. */
export function createFormat(locale: string): Format {
  const numbers = new Intl.NumberFormat(locale);
  const percents = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 });
  const dates = new Intl.DateTimeFormat(locale, { dateStyle: 'long' });
  const plurals = new Intl.PluralRules(locale);
  return {
    number: (value) => numbers.format(value),
    percent: (fraction) => percents.format(fraction),
    date: (date) => dates.format(date),
    plural: (count, forms) => forms[plurals.select(count)] ?? forms.other,
  };
}
