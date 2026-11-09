import { afterEach, describe, expect, it } from 'vitest';

import { applyTheme } from './theme';

describe('applyTheme', () => {
  afterEach(() => {
    document.documentElement.removeAttribute('data-theme');
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
