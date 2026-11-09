// @vitest-environment node
// The test reads the stylesheets next to it, which needs `import.meta.url` to be a file URL;
// under jsdom it is not.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const componentsDir = fileURLToPath(new URL('.', import.meta.url));

/**
 * The stylesheets of everything that can take keyboard focus. `Button` covers `IconButton`, the
 * `Dialog`'s close button and the `Toast`'s dismiss button; `Tabs` covers the tabs and the panel.
 * A new focusable component joins this list together with its `:focus-visible` rule (#77).
 */
const FOCUSABLE = [
  'Button/Button.module.css',
  'Menu/MenuItem.module.css',
  'RadioGroup/RadioGroup.module.css',
  'Slider/Slider.module.css',
  'Switch/Switch.module.css',
  'Tabs/Tabs.module.css',
];

/** The visible ring: a 2px outline in the component's focus token or the semantic one. */
const FOCUS_RING = /outline: 2px solid var\(--[a-z-]*focus(?:-ring)?\);/;

const stylesheets = readdirSync(componentsDir, { recursive: true, encoding: 'utf8' })
  .map((entry) => entry.replaceAll('\\', '/'))
  .filter((path) => path.endsWith('.module.css'))
  .sort()
  .map((path) => ({ path, css: readFileSync(join(componentsDir, path), 'utf8') }));

/** The bodies of the `:focus-visible` rules of a stylesheet. */
function focusRules(css: string): string[] {
  return [...css.matchAll(/:focus-visible\s*\{([^}]*)\}/g)].map((match) => match[1] ?? '');
}

describe('focus styles', () => {
  it('gives the focusable components, and only those, a :focus-visible rule', () => {
    const withRule = stylesheets.filter(({ css }) => focusRules(css).length > 0);

    expect(withRule.map(({ path }) => path)).toEqual(FOCUSABLE);
  });

  it('draws every focus ring as a 2px outline in a focus token, so it follows the theme', () => {
    const withoutRing = stylesheets.flatMap(({ path, css }) =>
      focusRules(css)
        .filter((rule) => !FOCUS_RING.test(rule))
        .map((rule) => `${path}: ${rule.trim()}`),
    );

    expect(withoutRing).toEqual([]);
  });
});
