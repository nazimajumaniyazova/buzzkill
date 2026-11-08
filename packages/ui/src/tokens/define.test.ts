import { describe, expect, expectTypeOf, it } from 'vitest';

import { collect, define, isToken, kebab } from './define';

describe('define', () => {
  const scale = define('scale', { 100: '#fff', deepBlue: '#00f', nested: { xs: '4px' } });

  it('names every leaf after its kebab-case path', () => {
    expect(scale[100]).toEqual({ name: '--scale-100', value: '#fff' });
    expect(scale.deepBlue.name).toBe('--scale-deep-blue');
    expect(scale.nested.xs.name).toBe('--scale-nested-xs');
    expectTypeOf(scale.deepBlue.name).toEqualTypeOf<'--scale-deep-blue'>();
    expectTypeOf(scale.nested.xs.name).toEqualTypeOf<'--scale-nested-xs'>();
  });

  it('turns a camelCase prefix into kebab-case as well', () => {
    expect(define('colorRole', { accent: '#00f' }).accent.name).toBe('--color-role-accent');
  });

  it('resolves a reference to the value of the token below and keeps the link', () => {
    const semantic = define('color', { accent: scale.deepBlue });

    expect(semantic.accent).toEqual({
      name: '--color-accent',
      value: '#00f',
      ref: scale.deepBlue,
    });
    expect(semantic.accent.ref).toBe(scale.deepBlue);
  });

  it('collects tokens depth first in definition order', () => {
    expect(collect(scale).map((token) => token.name)).toEqual([
      '--scale-100',
      '--scale-deep-blue',
      '--scale-nested-xs',
    ]);
  });

  it('tells tokens from groups and values', () => {
    expect(isToken(scale[100])).toBe(true);
    expect(isToken(scale.nested)).toBe(false);
    expect(isToken('#fff')).toBe(false);
    expect(isToken(null)).toBe(false);
  });

  it('converts camelCase keys and leaves the rest alone', () => {
    expect(kebab('lineHeight')).toBe('line-height');
    expect(kebab('xxl')).toBe('xxl');
    expect(kebab('600')).toBe('600');
  });
});
