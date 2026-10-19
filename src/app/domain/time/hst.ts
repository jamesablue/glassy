/**
 * Formatting in Hawaii-Aleutian Standard Time. Hawaii has no daylight saving, so every label is a
 * fixed UTC−10 offset however the viewer's own clock is set. All inputs are Unix seconds.
 */
export const HONOLULU_TIME_ZONE = 'Pacific/Honolulu';

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
