import { describe, expect, it } from 'vitest';

import { contrastRatio } from './contrast';
import { collect, type Token } from './define';
import { type ThemeName, themes } from './semantic';
import { tokens } from './tokens';

const CUSTOM_PROPERTY = /^--[a-z0-9]+(?:-[a-z0-9]+)*$/;
const HEX = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/;
const THEME_NAMES = ['day', 'night'] as const satisfies readonly ThemeName[];

/** Whether Stylelint would shorten the hex color (`#ffffff` to `#fff`). */
function hasLongHexForm(hex: string): boolean {
  const digits = hex.slice(1);
  if (digits.length !== 6 && digits.length !== 8) {
    return false;
  }
  for (let index = 0; index < digits.length; index += 2) {
    if (digits[index] !== digits[index + 1]) {
      return false;
    }
  }
  return true;
}

/** How many references lead from the token to a primitive. */
function layerOf(token: Token): number {
  let depth = 0;
  for (let below = token.ref; below !== undefined; below = below.ref) {
    depth += 1;
  }
  return depth;
}

const primitives = collect(tokens.primitives);
const { color, ...shared } = tokens.semantic;
const semantic = [...collect(shared), ...collect(color.day)];
const components = collect(tokens.components);

describe('design tokens', () => {
  it('names every token as a kebab-case custom property, each name once', () => {
    const names = [...primitives, ...semantic, ...components].map((token) => token.name);

    for (const name of names) {
      expect(name).toMatch(CUSTOM_PROPERTY);
    }
    expect(new Set(names).size).toBe(names.length);
  });

  it('stacks three layers: values, then meaning over values, then components over meaning', () => {
    for (const token of primitives) {
      expect(token.ref).toBeUndefined();
    }
    for (const token of semantic) {
      expect(layerOf(token)).toBe(1);
    }
    for (const token of components) {
      expect(layerOf(token)).toBe(2);
    }
  });

  it('rings every focusable component in the semantic focus color, so it follows the theme', () => {
    const rings = components.filter((token) => token.name.endsWith('-focus-ring'));

    expect(rings.map((token) => token.name).sort()).toEqual([
      '--button-focus-ring',
      '--radio-focus-ring',
      '--slider-focus-ring',
      '--switch-focus-ring',
      '--tabs-focus-ring',
    ]);
    for (const token of rings) {
      expect(token.ref?.name).toBe(color.day.focus.name);
    }
  });

  it('writes colors as short lowercase hex, the form Stylelint keeps in the stylesheet', () => {
    const colors = primitives.filter((token) => token.value.startsWith('#'));

    expect(colors.length).toBeGreaterThan(0);
    for (const token of colors) {
      expect(token.value).toMatch(HEX);
      expect(hasLongHexForm(token.value)).toBe(false);
    }
  });

  it('defines the same semantic colors in every theme, in the same order', () => {
    const names = collect(themes.day).map((token) => token.name);

    expect(Object.keys(themes)).toEqual(THEME_NAMES);
    for (const theme of Object.values(themes)) {
      expect(collect(theme).map((token) => token.name)).toEqual(names);
    }
  });

  describe.each(THEME_NAMES)('%s theme meets WCAG AA', (theme) => {
    const colors = themes[theme];
    const TEXT = 4.5;
    const CONTROL = 3;
    const pairs = [
      { fg: colors.text, bg: colors.canvas, min: TEXT },
      { fg: colors.textMuted, bg: colors.canvas, min: TEXT },
      { fg: colors.text, bg: colors.surface, min: TEXT },
      { fg: colors.textMuted, bg: colors.surface, min: TEXT },
      { fg: colors.text, bg: colors.surfaceHover, min: TEXT },
      { fg: colors.textMuted, bg: colors.surfaceHover, min: TEXT },
      { fg: colors.onAccent, bg: colors.accent, min: TEXT },
      { fg: colors.onAccent, bg: colors.accentHover, min: TEXT },
      { fg: colors.onDanger, bg: colors.danger, min: TEXT },
      { fg: colors.onDanger, bg: colors.dangerHover, min: TEXT },
      { fg: colors.onSuccess, bg: colors.success, min: TEXT },
      { fg: colors.onOverlay, bg: colors.overlay, under: colors.canvas, min: TEXT },
      { fg: colors.onOverlay, bg: colors.overlay, under: colors.surface, min: TEXT },
      { fg: colors.border, bg: colors.canvas, min: CONTROL },
      { fg: colors.border, bg: colors.surface, min: CONTROL },
      { fg: colors.focus, bg: colors.canvas, min: CONTROL },
      { fg: colors.focus, bg: colors.surface, min: CONTROL },
      { fg: colors.accent, bg: colors.canvas, min: CONTROL },
      { fg: colors.accent, bg: colors.surface, min: CONTROL },
      { fg: colors.accentHover, bg: colors.canvas, min: CONTROL },
      { fg: colors.accentHover, bg: colors.surface, min: CONTROL },
      { fg: colors.danger, bg: colors.canvas, min: CONTROL },
      { fg: colors.danger, bg: colors.surface, min: CONTROL },
      { fg: colors.dangerHover, bg: colors.canvas, min: CONTROL },
      { fg: colors.dangerHover, bg: colors.surface, min: CONTROL },
    ].map(({ fg, bg, under, min }) => ({
      label: `${fg.name} on ${bg.name}${under === undefined ? '' : ` over ${under.name}`}`,
      ratio: contrastRatio(fg.value, bg.value, under?.value),
      min,
    }));

    it.each(pairs)('$label reaches $min:1', ({ ratio, min }) => {
      expect(ratio).toBeGreaterThanOrEqual(min);
    });
  });

  describe('preference overrides', () => {
    const semanticNames = new Set(semantic.map((token) => token.name));
    const overrides = [
      ...collect(tokens.preferences.contrastMore),
      ...collect(tokens.preferences.reducedMotion),
    ];

    it('use the names of the semantic layer and reference primitives', () => {
      expect(overrides.length).toBeGreaterThan(0);
      for (const token of overrides) {
        expect(semanticNames.has(token.name)).toBe(true);
        expect(layerOf(token)).toBe(1);
      }
    });

    it('zero every duration under reduced motion', () => {
      const durations = collect(tokens.preferences.reducedMotion);

      expect(durations.map((token) => token.name)).toEqual([
        '--motion-fast',
        '--motion-normal',
        '--motion-slow',
      ]);
      for (const token of durations) {
        expect(token.value).toBe('0ms');
      }
    });

    describe.each(THEME_NAMES)('raise the contrast of the %s theme', (theme) => {
      const colors = themes[theme];
      const more = tokens.preferences.contrastMore[theme];
      const AAA_TEXT = 7;
      const RAISED_BORDER = 4.5;
      const pairs = [
        { key: 'text', bg: colors.canvas, min: AAA_TEXT },
        { key: 'text', bg: colors.surface, min: AAA_TEXT },
        { key: 'textMuted', bg: colors.canvas, min: AAA_TEXT },
        { key: 'textMuted', bg: colors.surface, min: AAA_TEXT },
        { key: 'border', bg: colors.canvas, min: RAISED_BORDER },
        { key: 'border', bg: colors.surface, min: RAISED_BORDER },
      ] as const;

      it.each(
        pairs.map(({ key, bg, min }) => ({
          label: `${more[key].name} on ${bg.name}`,
          base: contrastRatio(colors[key].value, bg.value),
          raised: contrastRatio(more[key].value, bg.value),
          min,
        })),
      )('$label goes above its base ratio and reaches $min:1', ({ base, raised, min }) => {
        expect(raised).toBeGreaterThan(base);
        expect(raised).toBeGreaterThanOrEqual(min);
      });
    });
  });
});
