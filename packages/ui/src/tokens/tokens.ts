import { button, dialog, menu, radio, slider, switchControl, tabs, toast } from './components';
import { duration, easing, font, layer, palette, radius, shadow, spacing } from './primitives';
import {
  motion,
  preferences,
  radius as semanticRadius,
  shadow as semanticShadow,
  space,
  text,
  themes,
  typography,
} from './semantic';

/**
 * The design tokens in their three layers (#74). This object is the single source: the
 * stylesheet `tokens.css` is generated from it, and code without a stylesheet reads the
 * resolved `value` of a token from it.
 */
export const tokens = {
  /** Layer 1: literal values. */
  primitives: { palette, spacing, font, radius, shadow, duration, easing, layer },
  /** Layer 2: meaning, defined over the primitives. Colors come per theme. */
  semantic: {
    color: themes,
    space,
    radius: semanticRadius,
    shadow: semanticShadow,
    motion,
    font: typography,
    text,
  },
  /** Layer 3: per component, defined over the semantic layer. */
  components: { button, dialog, menu, switch: switchControl, slider, radio, tabs, toast },
  /** Semantic tokens replaced under a user preference (#75); same names, other primitives. */
  preferences,
} as const;

export type Tokens = typeof tokens;
