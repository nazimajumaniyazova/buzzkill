import { define, type Defined, type Token } from './define';
import {
  duration,
  easing,
  font,
  palette,
  radius as radiusScale,
  shadow as shadowScale,
  spacing,
} from './primitives';

/**
 * Layer 2 of the design tokens (#74): names with a meaning, each defined over a primitive. The
 * colors come in two themes, `day` and `night`, which continue the game's own modes (#75);
 * everything else is the same in both.
 */

/**
 * The semantic colors every theme defines. A theme is a complete set of them, so a component
 * can use any of these in both themes.
 */
interface ThemeColorSource {
  /** The page and the play field behind everything. */
  readonly canvas: Token;
  /** Panels on the canvas: menus, dialogs, cards. */
  readonly surface: Token;
  readonly text: Token;
  readonly textMuted: Token;
  /** Borders and dividers; at least 3:1 against the canvas and the surface. */
  readonly border: Token;
  /** Primary actions. `onAccent` is the text on them. */
  readonly accent: Token;
  readonly onAccent: Token;
  /** Destructive actions, errors and damage. */
  readonly danger: Token;
  readonly onDanger: Token;
  /** Health, confirmations. A fill color: it carries `onSuccess` text, not text on the canvas. */
  readonly success: Token;
  readonly onSuccess: Token;
  /** The focus ring; at least 3:1 against the canvas and the surface. */
  readonly focus: Token;
  /** The translucent layer behind a dialog, over the canvas or a surface. */
  readonly overlay: Token;
  readonly onOverlay: Token;
}

export type ThemeColorTokens = Defined<ThemeColorSource, '--color'>;

export type ThemeName = 'day' | 'night';

const day = define('color', {
  canvas: palette.blue[100],
  surface: palette.neutral[0],
  text: palette.neutral[900],
  textMuted: palette.neutral[700],
  border: palette.neutral[500],
  accent: palette.blue[600],
  onAccent: palette.neutral[0],
  danger: palette.red[600],
  onDanger: palette.neutral[0],
  success: palette.green[500],
  onSuccess: palette.neutral[950],
  focus: palette.blue[700],
  overlay: palette.shade[60],
  onOverlay: palette.neutral[0],
} satisfies ThemeColorSource);

const night = define('color', {
  canvas: palette.blue[950],
  surface: palette.neutral[800],
  text: palette.neutral[50],
  textMuted: palette.neutral[300],
  border: palette.neutral[300],
  accent: palette.blue[400],
  onAccent: palette.neutral[950],
  danger: palette.red[400],
  onDanger: palette.neutral[950],
  success: palette.green[500],
  onSuccess: palette.neutral[950],
  focus: palette.amber[400],
  overlay: palette.shade[60],
  onOverlay: palette.neutral[0],
} satisfies ThemeColorSource);

export const themes = { day, night } as const satisfies Record<ThemeName, ThemeColorTokens>;

/** Padding (`inset`), vertical gaps (`stack`) and horizontal gaps (`inline`). */
export const space = define('space', {
  inset: { sm: spacing[2], md: spacing[4], lg: spacing[8] },
  stack: { sm: spacing[1], md: spacing[2], lg: spacing[4], xl: spacing[8] },
  inline: { sm: spacing[1], md: spacing[2], lg: spacing[4], xl: spacing[8] },
});

export const radius = define('radius', {
  control: radiusScale.md,
  surface: radiusScale.lg,
  pill: radiusScale.full,
});

export const shadow = define('shadow', { raised: shadowScale.md, text: shadowScale.xs });

export const motion = define('motion', {
  fast: duration.fast,
  normal: duration.normal,
  slow: duration.slow,
  easing: easing.standard,
  easingExit: easing.exit,
});

export const typography = define('font', {
  body: font.family.sans,
  display: font.family.sans,
  code: font.family.mono,
});

/**
 * Overrides under `prefers-contrast: more`: the text and border colors of each theme move to the
 * far end of the palette. The names are those of the semantic tokens they replace.
 */
const contrastMore = {
  day: define('color', {
    text: palette.neutral[950],
    textMuted: palette.neutral[900],
    border: palette.neutral[900],
  }),
  night: define('color', {
    text: palette.neutral[0],
    textMuted: palette.neutral[50],
    border: palette.neutral[0],
  }),
} as const satisfies Record<ThemeName, Partial<ThemeColorTokens>>;

/** Overrides under `prefers-reduced-motion: reduce`: every duration is zero. */
const reducedMotion = define('motion', {
  fast: duration.none,
  normal: duration.none,
  slow: duration.none,
}) satisfies Partial<typeof motion>;

/** Semantic tokens that a user preference replaces (#75). */
export const preferences = { contrastMore, reducedMotion } as const;
