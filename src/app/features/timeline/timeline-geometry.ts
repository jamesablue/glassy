import { clamp } from '../../domain/math';

/** Page Up and Page Down move the timeline by a day. */
export const HOURS_PER_PAGE = 24;

/**
 * The hour under a pointer along a strip that spans the whole forecast, such as the timeline track
 * or the score chart: each hour gets an equal slice, and points past either end pick the first or
 * last hour.
 *
 * @param offset distance from the strip's left edge, CSS pixels
 * @param width the strip's width, CSS pixels
 */
export function hourAtOffset(offset: number, width: number, hourCount: number): number {
  if (hourCount <= 0 || !(width > 0)) return 0;
  return clamp(Math.floor((offset / width) * hourCount), 0, hourCount - 1);
}

/** Where a (possibly fractional) hour sits along the strip, as a percentage of its width. */
export function hourPercent(hour: number, hourCount: number): number {
  return hourCount > 0 ? (hour / hourCount) * 100 : 0;
}

/**
 * The hour a key moves the timeline slider to, following the WAI-ARIA slider pattern: the arrows
 * step an hour, Page Up and Page Down a day, Home and End go to the ends. `null` for other keys.
 * The result is not clamped; the timeline does that.
 */
export function hourForKey(key: string, hour: number, hourCount: number): number | null {
  switch (key) {
    case 'ArrowRight':
    case 'ArrowUp':
      return hour + 1;
    case 'ArrowLeft':
    case 'ArrowDown':
      return hour - 1;
    case 'PageUp':
      return hour + HOURS_PER_PAGE;
    case 'PageDown':
      return hour - HOURS_PER_PAGE;
    case 'Home':
      return 0;
    case 'End':
      return hourCount - 1;
    default:
      return null;
  }
}
