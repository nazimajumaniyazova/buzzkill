// @vitest-environment node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { tokens } from '@buzzkill/ui';
import { describe, expect, it } from 'vitest';

/** The stylesheet of the app, where the animations of the HUD live (#160). */
const css = readFileSync(fileURLToPath(new URL('index.css', import.meta.url)), 'utf8');

/** The duration tokens of the motion layer, by the end of their name. */
const DURATIONS = {
  fast: tokens.semantic.motion.fast,
  normal: tokens.semantic.motion.normal,
  slow: tokens.semantic.motion.slow,
} as const;

function isDuration(name: string | undefined): name is keyof typeof DURATIONS {
  return name !== undefined && Object.hasOwn(DURATIONS, name);
}

/**
 * The `animation` of a rule: the duration its motion token resolves to, and the times it plays;
 * `undefined` without a duration token and the token easing.
 */
function animation(selector: string): { readonly ms: number; readonly times: number } | undefined {
  const rule = new RegExp(`${selector.replace('.', '\\.')}\\s*\\{([^}]*)\\}`).exec(css);
  const value = /animation:([^;]*);/.exec(rule?.[1] ?? '')?.[1] ?? '';
  const duration = /var\(--motion-(\w+)\)/.exec(value)?.[1];
  if (!isDuration(duration) || !value.includes('var(--motion-easing)')) {
    return undefined;
  }
  return {
    ms: Number.parseFloat(DURATIONS[duration].value),
    times: Number(/\s(\d+)\s*$/.exec(value)?.[1] ?? 1),
  };
}

describe('the animations of the HUD', () => {
  it('play on the motion tokens, which reduced motion shortens to nothing', () => {
    expect(animation('.hud-bounce')?.ms).toBeGreaterThan(0);
    expect(animation('.hud-blink')?.ms).toBeGreaterThan(0);
    for (const token of Object.values(tokens.preferences.reducedMotion)) {
      expect(Number.parseFloat(token.value)).toBe(0);
    }
  });

  it('blink a lost life more than once, but no more than three times a second', () => {
    const blink = animation('.hud-blink');

    // One blink is a pair of opposing changes of luminance: a flash in the sense of WCAG 2.3.1.
    expect(1000 / (blink?.ms ?? 0)).toBeLessThanOrEqual(3);
    expect(blink?.times).toBeGreaterThan(1);
  });
});
