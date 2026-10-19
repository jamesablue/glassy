/**
 * Formatting in Hawaii-Aleutian Standard Time. Hawaii has no daylight saving, so every label is a
 * fixed UTC−10 offset however the viewer's own clock is set. All inputs are Unix seconds.
 */
export const HONOLULU_TIME_ZONE = 'Pacific/Honolulu';

/** Honolulu's offset from UTC, hours. */
export const HONOLULU_UTC_OFFSET_HOURS = -10;

const hourFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: HONOLULU_TIME_ZONE,
  hour: 'numeric',
});
const weekdayFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: HONOLULU_TIME_ZONE,
  weekday: 'short',
});
const dayOfMonthFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: HONOLULU_TIME_ZONE,
  day: 'numeric',
});
/** The en-CA locale formats dates as ISO `YYYY-MM-DD`. */
const dateKeyFormat = new Intl.DateTimeFormat('en-CA', { timeZone: HONOLULU_TIME_ZONE });

const MS_PER_SECOND = 1000;
const SECONDS_PER_HOUR = 3600;
const HOUR_KEY = /^(\d{4})-(\d{2})-(\d{2})T(\d{2})$/;

/** Hour of day, for example "3 PM". */
export function hourLabel(unixSeconds: number): string {
  return hourFormat.format(unixSeconds * MS_PER_SECOND);
}

/** Short weekday, for example "Sun". */
export function weekdayLabel(unixSeconds: number): string {
  return weekdayFormat.format(unixSeconds * MS_PER_SECOND);
}

/** Weekday and day of the month, for example "Sun 18". */
export function dayLabel(unixSeconds: number): string {
  return `${weekdayLabel(unixSeconds)} ${dayOfMonthFormat.format(unixSeconds * MS_PER_SECOND)}`;
}

/** Weekday and hour, for example "Sun 3 PM". */
export function timeLabel(unixSeconds: number): string {
  return `${weekdayLabel(unixSeconds)} ${hourLabel(unixSeconds)}`;
}

/** A span of hours on the start's weekday, for example "Sun 9 AM–12 PM". */
export function hourRangeLabel(startSeconds: number, endSeconds: number): string {
  return `${timeLabel(startSeconds)}–${hourLabel(endSeconds)}`;
}

/** Calendar date in Honolulu as `YYYY-MM-DD`. Equal keys mean the same local day. */
export function dateKey(unixSeconds: number): string {
  return dateKeyFormat.format(unixSeconds * MS_PER_SECOND);
}

/**
 * The Honolulu hour that contains a time, as `YYYY-MM-DDTHH` (for example `2026-10-20T08` for 8 AM
 * on 20 October). It is the ISO 8601 local date and hour, so it reads naturally in a shared link,
 * sorts as text and needs no time zone suffix because the forecast is always in Honolulu time.
 *
 * @throws RangeError when `unixSeconds` is not a finite time
 */
export function hourKey(unixSeconds: number): string {
  const local = (unixSeconds + HONOLULU_UTC_OFFSET_HOURS * SECONDS_PER_HOUR) * MS_PER_SECOND;
  return new Date(local).toISOString().slice(0, 13);
}

/**
 * The start of the Honolulu hour an {@link hourKey} names, Unix seconds, or `null` when the text is
 * not a real hour (wrong shape, month 13, 30 February, hour 24 and so on).
 */
export function parseHourKey(key: string): number | null {
  const match = HOUR_KEY.exec(key);
  if (!match) return null;
  const part = (group: number): number => Number(match[group]);
  const utcHour = part(4) - HONOLULU_UTC_OFFSET_HOURS;
  const seconds = Date.UTC(part(1), part(2) - 1, part(3), utcHour) / MS_PER_SECOND;
  // Date.UTC rolls invalid parts over (30 February becomes 2 March), so only a round trip is real.
  return hourKey(seconds) === key ? seconds : null;
}
