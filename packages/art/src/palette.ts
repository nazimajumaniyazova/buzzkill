/**
 * The colors of the art. Where a color exists in the design tokens of `@buzzkill/ui` it has the same
 * value (`tokens.primitives.palette`), so the sprites and the interface agree; the rest are the
 * art's own. The package keeps its copy instead of importing the design system, which would bring
 * React and CSS into a build-time package.
 */
export const PALETTE = {
  /** `amber.400` */
  amber: '#f5c242',
  amberDark: '#d99a1c',
  orange: '#f5a23a',
  /** `red.400` */
  red: '#e8655a',
  cream: '#fff6d6',
  /** `blue.500` */
  blue: '#3b7dd8',
  /** `blue.700` */
  blueDark: '#245494',
  /** `blue.300` */
  blueLight: '#8ab6ef',
  /** `blue.100` */
  blueMist: '#bfe3ff',
  /** `pink.400` */
  pink: '#e07aa5',
  pinkDark: '#b4507e',
  pinkLight: '#f5bfd6',
  cyan: '#2bc4d8',
  teal: '#2f9d8f',
  tealDark: '#1f6f66',
  tealLight: '#7fd6c8',
  violet: '#5b4a8a',
  violetBody: '#463d66',
  violetRim: '#a99be0',
  lavender: '#cfc4ea',
  glow: '#e6ff7a',
  glowCore: '#fbffd6',
  /** `neutral.50` */
  white: '#f5f7fa',
  /** `neutral.100` */
  silver: '#e9edf2',
  /** `neutral.200` */
  silverShade: '#d2d9e2',
  /** `neutral.300` */
  steel: '#aab4c3',
  /** `neutral.500` */
  slate: '#5f6b7d',
  /** `neutral.700` */
  graphite: '#353d4c',
  shell: '#3a3f52',
  body: '#2a2f3d',
  hair: '#5b3a32',
  hairLight: '#9c6a5a',
} as const;
