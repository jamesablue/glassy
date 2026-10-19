import type { Ink, Rgb } from '../models';

/** The text colours an {@link Ink} stands for: black and white. */
export const INK_COLORS: Readonly<Record<Ink, Rgb>> = {
  dark: [0, 0, 0],
  light: [255, 255, 255],
};

/** WCAG 2 minimum contrast for normal-size text (success criterion 1.4.3). */
export const MIN_TEXT_CONTRAST = 4.5;

/** A colour's relative luminance as WCAG 2 defines it: 0 for black, 1 for white. */
export function relativeLuminance([red, green, blue]: Rgb): number {
  const linear = (channel: number): number => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(red) + 0.7152 * linear(green) + 0.0722 * linear(blue);
}

/** The WCAG 2 contrast ratio between two colours, from 1 (none) to 21 (black on white). */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const [lighter, darker] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return ((lighter ?? 0) + 0.05) / ((darker ?? 0) + 0.05);
}

/**
 * The text colour that reads best on every one of `backgrounds` (a solid fill, or the colours a
 * label spans on a gradient): the ink whose lowest contrast ratio is highest. Black or white text
 * always reaches at least 4.58:1 on a single colour, so a solid fill always meets
 * {@link MIN_TEXT_CONTRAST}.
 */
export function inkFor(...backgrounds: readonly Rgb[]): Ink {
  const worst = (ink: Ink): number =>
    Math.min(...backgrounds.map((background) => contrastRatio(INK_COLORS[ink], background)));
  return worst('dark') >= worst('light') ? 'dark' : 'light';
}

/** The colour `share` of the way from `from` to `to`, channel by channel. */
export function mixRgb(from: Rgb, to: Rgb, share: number): Rgb {
  const channel = (index: 0 | 1 | 2): number =>
    Math.round(from[index] + (to[index] - from[index]) * share);
  return [channel(0), channel(1), channel(2)];
}
