// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { en } from './en';
import { createFormat } from './format';
import { ru } from './ru';

const english = en(createFormat('en'));
const russian = ru(createFormat('ru'));

const NBSP = ' ';

/** Every leaf of a dictionary by its path, "menu.play", with its value. */
function leaves(messages: Readonly<Record<string, unknown>>, prefix = ''): [string, unknown][] {
  return Object.entries(messages).flatMap(([key, value]): [string, unknown][] => {
    const path = prefix === '' ? key : `${prefix}.${key}`;
    return typeof value === 'object' && value !== null
      ? leaves(value as Record<string, unknown>, path)
      : [[path, value]];
  });
}

/**
 * The strings that are the same in both languages on purpose: the game's name, and the keys and
 * gamepad buttons that Russian hardware labels in Latin letters too.
 */
const SAME_IN_BOTH = [
  'keys.Escape',
  'keys.Enter',
  'keys.Tab',
  'keys.Backspace',
  'menu.title',
  'help.padButtons.a',
  'help.padButtons.b',
  'help.padButtons.start',
];

describe('the dictionaries', () => {
  it('have the same paths, each a string or a message in both', () => {
    const kinds = (messages: Readonly<Record<string, unknown>>) =>
      leaves(messages).map(([path, value]) => [path, typeof value]);

    expect(kinds(russian)).toEqual(kinds(english));
    expect(new Set(kinds(english).map(([, kind]) => kind))).toEqual(
      new Set(['string', 'function']),
    );
  });

  it('translate every string, apart from the names that stay', () => {
    const russianLeaves = new Map(leaves(russian));
    const same = leaves(english)
      .filter(([path, value]) => typeof value === 'string' && russianLeaves.get(path) === value)
      .map(([path]) => path);

    expect(same).toEqual(SAME_IN_BOTH);
  });

  it('hold no empty string and no space at either end', () => {
    const untidy = [...leaves(english), ...leaves(russian)].filter(
      ([, value]) => typeof value === 'string' && (value === '' || value.trim() !== value),
    );

    expect(untidy).toEqual([]);
  });
});

describe('the messages with values', () => {
  it('say how many hits end a run, in the plural form of the count', () => {
    expect(english.help.intro(1)).toMatch(/ 1 hit and the run is over\.$/);
    expect(english.help.intro(5)).toMatch(/ 5 hits and the run is over\.$/);
    expect(russian.help.intro(1)).toMatch(/ 1 попадание — и игра окончена\.$/);
    expect(russian.help.intro(3)).toMatch(/ 3 попадания — и игра окончена\.$/);
    expect(russian.help.intro(5)).toMatch(/ 5 попаданий — и игра окончена\.$/);
    expect(russian.help.intro(21)).toMatch(/ 21 попадание — и игра окончена\.$/);
  });

  it('write the numbers of the score and the lives in the language', () => {
    expect(english.runOver.score(12345)).toBe('Score: 12,345');
    expect(russian.runOver.score(12345)).toBe(`Счёт: 12${NBSP}345`);
    expect(english.hud.livesValue(3, 5)).toBe('3 of 5');
    expect(russian.hud.livesValue(3, 5)).toBe('3 из 5');
  });

  it('name the action, the slot and the key of a binding', () => {
    expect(english.keyEditor.button({ action: 'Shoot', slot: 2, key: 'J' })).toBe(
      'Shoot, key 2: J',
    );
    expect(russian.keyEditor.button({ action: 'Стрелять', slot: 2, key: 'J' })).toBe(
      'Стрелять, клавиша 2: J',
    );
    expect(english.keyEditor.bound({ action: 'Pause', key: 'Space' })).toBe(
      'Pause now uses Space.',
    );
    expect(russian.keyEditor.bound({ action: 'Пауза', key: 'Пробел' })).toBe(
      'Действие «Пауза» теперь на клавише Пробел.',
    );
    expect(
      russian.keyEditor.displaced({ key: 'Пробел', action: 'Стрелять', newKey: 'Escape' }),
    ).toBe('Клавиша Пробел была у действия «Стрелять», теперь у него клавиша Escape.');
  });

  it('name the file and the reason of a failed load', () => {
    expect(
      english.loading.failure({ file: 'shot.wav', reason: english.loading.reasons.decode }),
    ).toBe('shot.wav: the file is damaged');
    expect(
      russian.loading.failure({ file: 'shot.wav', reason: russian.loading.reasons.decode }),
    ).toBe('shot.wav: файл повреждён');
  });
});
