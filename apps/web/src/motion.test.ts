import { afterEach, describe, expect, it } from 'vitest';

import { applyMotion } from './motion';

describe('applyMotion', () => {
  afterEach(() => {
    document.documentElement.removeAttribute('data-motion');
  });

  it('pins reduced or full motion on the root element and lets system remove it', () => {
    const root = document.createElement('div');

    applyMotion('reduced', root);
    expect(root).toHaveAttribute('data-motion', 'reduced');
    applyMotion('full', root);
    expect(root).toHaveAttribute('data-motion', 'full');
    applyMotion('system', root);
    expect(root).not.toHaveAttribute('data-motion');

    applyMotion('reduced');
    expect(document.documentElement).toHaveAttribute('data-motion', 'reduced');
  });
});
