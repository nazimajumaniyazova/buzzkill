import type { TokenGroup } from './define';
import { duration, easing, font, layer, palette, radius, shadow, spacing } from './primitives';
import {
  motion,
  radius as semanticRadius,
  shadow as semanticShadow,
  space,
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
  },
  /** Layer 3: per component, defined over the semantic layer. The first component (#79) adds the first group. */
  components: {} as TokenGroup,
} as const;

export type Tokens = typeof tokens;
