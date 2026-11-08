import { describe, expect, it } from 'vitest';

import { cx } from './cx';

describe('cx', () => {
  it('joins class names with a space and drops empty, false and nullish parts', () => {
    expect(cx('a', 'b')).toBe('a b');
    expect(cx('a', undefined, null, false, '', 'b')).toBe('a b');
    expect(cx()).toBe('');
  });
});
