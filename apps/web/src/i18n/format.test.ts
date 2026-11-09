// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { createFormat } from './format';

const english = createFormat('en');
const russian = createFormat('ru');

// Russian groups digits and parts a percent sign with a no-break space, U+00A0.
const NBSP = ' ';

describe('createFormat', () => {
  it('groups the digits of a number the way the language does', () => {
    expect(english.number(1234567)).toBe('1,234,567');
    expect(russian.number(1234567)).toBe(`1${NBSP}234${NBSP}567`);
    expect(english.number(0)).toBe('0');
  });

  it('writes a fraction as a whole percentage', () => {
    expect(english.percent(0.3)).toBe('30%');
    expect(russian.percent(0.3)).toBe(`30${NBSP}%`);
    expect(english.percent(0.666)).toBe('67%');
    expect(english.percent(1)).toBe('100%');
  });

  it('writes a date in the long style of the language', () => {
    const date = new Date(2026, 10, 9);

    expect(english.date(date)).toBe('November 9, 2026');
    expect(russian.date(date)).toBe('9 ноября 2026 г.');
  });

  it('picks the English form by one and other', () => {
    const hits = { one: 'hit', other: 'hits' };

    expect([0, 1, 2, 5, 21].map((count) => english.plural(count, hits))).toEqual([
      'hits',
      'hit',
      'hits',
      'hits',
      'hits',
    ]);
  });

  it('picks the Russian form by one, few, many and other', () => {
    const files = { one: 'файл', few: 'файла', many: 'файлов', other: 'файла' };

    expect([1, 2, 5, 11, 12, 21, 22, 25, 111, 1.5].map((n) => russian.plural(n, files))).toEqual([
      'файл',
      'файла',
      'файлов',
      'файлов',
      'файлов',
      'файл',
      'файла',
      'файлов',
      'файлов',
      'файла',
    ]);
  });

  it('falls back to other for a category the forms leave out', () => {
    expect(russian.plural(5, { one: 'файл', other: 'файлы' })).toBe('файлы');
  });
});
