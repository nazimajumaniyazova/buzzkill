import { define } from './define';

/**
 * Layer 1 of the design tokens (#74): literal values with no meaning attached. Nothing outside
 * this file and the stylesheet generated from it holds a literal color or length; Stylelint
 * enforces that in CSS, and the semantic layer references these tokens in TypeScript.
 *
 * Colors are hex, lowercase and as short as they can be, which is the form Stylelint keeps in
 * the generated stylesheet; `tokens.test.ts` checks that.
 */

export const palette = define('palette', {
  neutral: {
    0: '#fff',
    50: '#f5f7fa',
    100: '#e9edf2',
    200: '#d2d9e2',
    300: '#aab4c3',
    500: '#5f6b7d',
    700: '#353d4c',
    800: '#222835',
    900: '#141821',
    950: '#0b0e14',
  },
  blue: {
    100: '#bfe3ff',
    400: '#6aa2ea',
    500: '#3b7dd8',
    600: '#2f6bc0',
    700: '#245494',
    950: '#121a2b',
  },
  pink: { 400: '#e07aa5' },
  red: { 400: '#e8655a', 600: '#c0392b' },
  green: { 500: '#48bf53' },
  amber: { 400: '#f5c242' },
  /** Translucent black for overlays; the key is the opacity in percent. */
  shade: { 30: '#0000004d', 60: '#0009', 80: '#000c' },
});

/** The spacing scale in multiples of 4 px; the key is the multiple. */
export const spacing = define('spacing', {
  1: '4px',
  2: '8px',
  3: '12px',
  4: '16px',
  6: '24px',
  8: '32px',
  12: '48px',
});

export const font = define('font', {
  family: { sans: 'system-ui, sans-serif', mono: 'ui-monospace, monospace' },
  size: { sm: '0.875rem', md: '1rem', lg: '1.25rem', xl: '1.75rem', xxl: '2.5rem' },
  weight: { regular: '400', bold: '700' },
  lineHeight: { tight: '1.2', normal: '1.5' },
});

export const radius = define('radius', { sm: '4px', md: '8px', lg: '16px', full: '9999px' });

export const shadow = define('shadow', {
  xs: '0 1px 2px #000c',
  sm: '0 1px 2px #0000004d',
  md: '0 4px 12px #00000040',
});

export const duration = define('duration', { fast: '100ms', normal: '200ms', slow: '400ms' });

export const easing = define('easing', {
  standard: 'cubic-bezier(0.2, 0, 0, 1)',
  exit: 'cubic-bezier(0.4, 0, 1, 1)',
});

/** Stacking order; a component uses a layer, never a number of its own. */
export const layer = define('layer', { base: '0', raised: '10', overlay: '100', toast: '1000' });
