import { describe, expect, it } from 'vitest';

describe('@buzzkill/game', () => {
  it('loads in a Node environment without a DOM', async () => {
    await expect(import('./index')).resolves.toBeDefined();
    expect('window' in globalThis).toBe(false);
  });
});
