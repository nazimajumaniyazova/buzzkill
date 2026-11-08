import { define } from './define';
import { motion, radius, shadow, space, text, themes } from './semantic';

/**
 * Layer 3 of the design tokens: what a component needs, defined over the semantic layer. A
 * color reference names the semantic token, so in the stylesheet the value follows the theme at
 * use time; the day value stored here serves code without a stylesheet.
 */
const color = themes.day;

export const button = define('button', {
  gap: space.inline.md,
  radius: radius.control,
  transition: motion.fast,
  focusRing: color.focus,
  paddingBlock: { sm: space.inset.xs, md: space.inset.sm, lg: space.inset.sm },
  paddingInline: { sm: space.inset.sm, md: space.inset.md, lg: space.inset.lg },
  fontSize: { sm: text.sm, md: text.md, lg: text.lg },
  primary: {
    background: color.accent,
    backgroundHover: color.accentHover,
    text: color.onAccent,
  },
  secondary: {
    background: color.surface,
    backgroundHover: color.surfaceHover,
    text: color.text,
    border: color.border,
  },
  danger: {
    background: color.danger,
    backgroundHover: color.dangerHover,
    text: color.onDanger,
  },
});

export const dialog = define('dialog', {
  padding: space.inset.lg,
  /** The least distance between the dialog and the edge of the viewport. */
  margin: space.inset.md,
  radius: radius.surface,
  shadow: shadow.raised,
  background: color.surface,
  text: color.text,
  border: color.border,
  backdrop: color.overlay,
  titleSize: text.lg,
});

export const menu = define('menu', {
  padding: space.inset.xs,
  radius: radius.control,
  shadow: shadow.raised,
  background: color.surface,
  text: color.text,
  border: color.border,
  item: {
    paddingBlock: space.inset.xs,
    paddingInline: space.inset.sm,
    radius: radius.control,
    backgroundHover: color.surfaceHover,
  },
});

/** `switch` is a reserved word, so the group is `switchControl` in TypeScript. */
export const switchControl = define('switch', {
  track: color.border,
  trackChecked: color.accent,
  thumb: color.surface,
  radius: radius.pill,
  gap: space.inline.md,
  focusRing: color.focus,
});

export const slider = define('slider', {
  accent: color.accent,
  gap: space.inline.md,
  focusRing: color.focus,
});

export const radio = define('radio', {
  accent: color.accent,
  /** Between the circle and its label. */
  gap: space.inline.md,
  /** Between the options. */
  itemGap: space.inline.lg,
  focusRing: color.focus,
});
