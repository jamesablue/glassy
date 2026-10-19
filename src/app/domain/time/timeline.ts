import { clamp } from '../math/clamp';
import { dateKey, dayLabel } from './hst';

const HOUR_SECONDS = 3600;

/** A Honolulu calendar day on the forecast timeline. */
export interface DayGroup {
  /** `YYYY-MM-DD`, comparable with `dateKey(now)` to find today. */
  readonly dateKey: string;
  /** For example "Sun 18". */
  readonly label: string;
  /** Index of the day's first forecast hour. */
  readonly start: number;
  /** Number of forecast hours in the day. */
  readonly count: number;
}

/** A run of consecutive forecast hours. */
export interface HourRun {
  readonly start: number;
  readonly count: number;
}

/**
 * Index of the forecast hour that contains `nowSeconds`: the last hour starting at or before it.
 * Falls back to the first hour when now is before the forecast or no hour starts after it, so a
 * stale forecast opens at its beginning instead of at its end.
 *
 * @param times start of each forecast hour, Unix seconds
 */
export function currentHourIndex(times: readonly number[], nowSeconds: number): number {
  const next = times.findIndex((time) => time > nowSeconds);
  return next > 0 ? next - 1 : 0;
}

/**
 * Index of the forecast hour that contains `unixSeconds`, clamped to the forecast: a time before it
 * maps to the first hour and a time after it to the last. Unlike {@link currentHourIndex}, which
 * opens a stale forecast at its start, this keeps a requested time as close as the forecast allows.
 *
 * @param times start of each forecast hour, Unix seconds
 */
export function hourIndexAt(times: readonly number[], unixSeconds: number): number {
  const next = times.findIndex((time) => time > unixSeconds);
  if (next < 0) return Math.max(times.length - 1, 0);
  return Math.max(next - 1, 0);
}

/**
 * Where now sits on the timeline in fractional hours: the current hour's index plus how far
 * through that hour now is. Used to place the "now" marker between hour ticks.
 */
export function nowPosition(times: readonly number[], nowSeconds: number): number {
  const index = currentHourIndex(times, nowSeconds);
  const start = times[index];
  if (start === undefined) return 0;
  return index + clamp((nowSeconds - start) / HOUR_SECONDS, 0, 1);
}

/** Splits the forecast hours into Honolulu calendar days, in order. */
export function groupHoursByDay(times: readonly number[]): DayGroup[] {
  const days: { dateKey: string; label: string; start: number; count: number }[] = [];
  times.forEach((time, hour) => {
    const key = dateKey(time);
    const today = days.at(-1);
    if (today?.dateKey === key) {
      today.count++;
    } else {
      days.push({ dateKey: key, label: dayLabel(time), start: hour, count: 1 });
    }
  });
  return days;
}

/** The runs of night hours, for shading the timeline and score charts. */
export function nightRuns(isDay: readonly boolean[]): HourRun[] {
  const runs: HourRun[] = [];
  let start = -1;
  for (let hour = 0; hour <= isDay.length; hour++) {
    const isNight = hour < isDay.length && !isDay[hour];
    if (isNight && start < 0) start = hour;
    if (!isNight && start >= 0) {
      runs.push({ start, count: hour - start });
      start = -1;
    }
  }
  return runs;
}
