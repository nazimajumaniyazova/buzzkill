import { afterEach, describe, expect, it } from 'vitest';

import { applyTheme, isThemeChoice, readThemeChoice, writeThemeChoice } from './theme';

describe('theme choice', () => {
  afterEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('accepts only the three choices', () => {
    expect(isThemeChoice('system')).toBe(true);
    expect(isThemeChoice('day')).toBe(true);
    expect(isThemeChoice('night')).toBe(true);
    expect(isThemeChoice('sepia')).toBe(false);
    expect(isThemeChoice(null)).toBe(false);
  });

  it('reads system when nothing or garbage is stored, and round-trips a choice', () => {
    expect(readThemeChoice()).toBe('system');

    localStorage.setItem('buzzkill.theme', 'sepia');
    expect(readThemeChoice()).toBe('system');

    writeThemeChoice('night');
    expect(localStorage.getItem('buzzkill.theme')).toBe('night');
    expect(readThemeChoice()).toBe('night');
  });

  it('survives a storage that throws or is missing', () => {
    const blocked = {
      getItem: (): string | null => {
        throw new Error('blocked');
      },
      setItem: (): void => {
        throw new Error('full');
      },
    };

    expect(readThemeChoice(blocked)).toBe('system');
    expect(() => {
      writeThemeChoice('day', blocked);
    }).not.toThrow();
    expect(readThemeChoice(null)).toBe('system');
    expect(() => {
      writeThemeChoice('day', null);
    }).not.toThrow();
  });

  it('pins a theme on the root element and lets system remove it', () => {
    const root = document.createElement('div');

    applyTheme('night', root);
    expect(root).toHaveAttribute('data-theme', 'night');
    applyTheme('day', root);
    expect(root).toHaveAttribute('data-theme', 'day');
    applyTheme('system', root);
    expect(root).not.toHaveAttribute('data-theme');

    applyTheme('night');
    expect(document.documentElement).toHaveAttribute('data-theme', 'night');
  });
});
