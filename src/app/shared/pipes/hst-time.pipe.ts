import { Pipe, type PipeTransform } from '@angular/core';
import { dayLabel, hourLabel, timeLabel, weekdayLabel } from '../../domain/time';
import { NO_VALUE } from '../../domain/units';
import { isValue } from './is-value';

/** How much of a time {@link HstTimePipe} shows. */
export type HstTimeFormat = 'time' | 'hour' | 'weekday' | 'day';

const FORMATTERS: Readonly<Record<HstTimeFormat, (unixSeconds: number) => string>> = {
  time: timeLabel,
  hour: hourLabel,
  weekday: weekdayLabel,
  day: dayLabel,
};

/**
 * A time (Unix seconds) in Hawaii time, which the forecast is always shown in:
 *
 * - `{{ t | hstTime }}` → "Sun 3 PM"
 * - `{{ t | hstTime: 'hour' }}` → "3 PM"
 * - `{{ t | hstTime: 'weekday' }}` → "Sun"
 * - `{{ t | hstTime: 'day' }}` → "Sun 18"
 *
 * A missing time reads "—".
 */
@Pipe({ name: 'hstTime' })
export class HstTimePipe implements PipeTransform {
  transform(unixSeconds: number | null | undefined, format: HstTimeFormat = 'time'): string {
    return isValue(unixSeconds) ? FORMATTERS[format](unixSeconds) : NO_VALUE;
  }
}
