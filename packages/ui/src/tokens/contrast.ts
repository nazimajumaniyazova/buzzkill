/**
 * WCAG 2 contrast arithmetic for the token tests (#74, #75, #77). The tokens write colors as
 * hex, so that is the only syntax parsed here.
 */

/** A color in sRGB, channels and alpha from 0 to 1. */
export interface Rgba {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly a: number;
}

const HEX = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

/** Parses a hex color of three, four, six or eight digits, the last two of them alpha. */
export function parseHex(hex: string): Rgba {
  const match = HEX.exec(hex);
  if (match === null) {
    throw new Error(`Not a hex color: ${hex}`);
  }
  // The pattern has one group, so a match always fills it.
  const digits = match[1] as string;
  // The short forms double every digit: `#abc` is `#aabbcc`.
  const full = digits.length <= 4 ? digits.replace(/./g, '$&$&') : digits;
  const channel = (index: number): number =>
    Number.parseInt(full.slice(index * 2, index * 2 + 2), 16) / 255;
  return { r: channel(0), g: channel(1), b: channel(2), a: full.length === 8 ? channel(3) : 1 };
}

/** WCAG 2 relative luminance of an opaque color, 0 for black and 1 for white. */
export function relativeLuminance({ r, g, b }: Rgba): number {
  const linear = (channel: number): number =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

/** `top` over `bottom` with straight alpha, in gamma space, as browsers composite by default. */
export function composite(top: Rgba, bottom: Rgba): Rgba {
  const a = top.a + bottom.a * (1 - top.a);
  const mix = (over: number, under: number): number =>
    a === 0 ? 0 : (over * top.a + under * bottom.a * (1 - top.a)) / a;
  return { r: mix(top.r, bottom.r), g: mix(top.g, bottom.g), b: mix(top.b, bottom.b), a };
}

/**
 * WCAG 2 contrast ratio of `foreground` on `background`, from 1 to 21. A translucent
 * background is composited on `under` first and a translucent foreground on the result, so an
 * overlay is checked against what it actually covers. Level AA asks for 4.5 for text and 3 for
 * borders, focus rings and the other parts of a control.
 */
export function contrastRatio(foreground: string, background: string, under = '#fff'): number {
  const base = composite(parseHex(background), parseHex(under));
  const text = composite(parseHex(foreground), base);
  const textLuminance = relativeLuminance(text);
  const baseLuminance = relativeLuminance(base);
  const lighter = Math.max(textLuminance, baseLuminance);
  const darker = Math.min(textLuminance, baseLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}
