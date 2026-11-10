import { render, screen } from '@testing-library/react';
import type { JSX } from 'react';
import { describe, expect, it } from 'vitest';

import { createI18n, i18nFor, I18nProvider, labelled, LANGUAGE_NAMES, useI18n } from './i18n';

function Title(): JSX.Element {
  const { language, t } = useI18n();
  return <h1 lang={language}>{t.settings.title}</h1>;
}

describe('i18nFor', () => {
  it('gives each language its strings and formatters, the same object on every call', () => {
    expect(i18nFor('ru')).toBe(i18nFor('ru'));
    expect(i18nFor('en').t.menu.play).toBe('Play');
    expect(i18nFor('ru').t.menu.play).toBe('Играть');
    expect(i18nFor('ru').format.number(1234)).toBe('1 234');
  });
});

describe('createI18n', () => {
  it('builds a language from the dictionary it is given', () => {
    const i18n = createI18n('en', (format) => ({
      ...i18nFor('en').t,
      menu: { ...i18nFor('en').t.menu, play: format.percent(1) },
    }));

    expect(i18n.t.menu.play).toBe('100%');
  });
});

describe('useI18n', () => {
  it('speaks English without a provider', () => {
    render(<Title />);

    expect(screen.getByRole('heading', { name: 'Settings' })).toHaveAttribute('lang', 'en');
  });

  it('speaks the language of the nearest provider', () => {
    render(
      <I18nProvider i18n={i18nFor('ru')}>
        <Title />
      </I18nProvider>,
    );

    expect(screen.getByRole('heading', { name: 'Настройки' })).toHaveAttribute('lang', 'ru');
  });
});

describe('labelled', () => {
  it('labels the values in their order', () => {
    expect(labelled(['ru', 'en'], LANGUAGE_NAMES)).toEqual([
      { value: 'ru', label: 'Русский' },
      { value: 'en', label: 'English' },
    ]);
  });
});
