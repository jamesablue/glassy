import { dateKey, dayLabel, hourLabel, hourRangeLabel, timeLabel, weekdayLabel } from './hst';

/** Unix seconds for a UTC date and hour. Honolulu is UTC−10 all year. */
const utc = (month: number, day: number, hour: number): number =>
  Date.UTC(2026, month - 1, day, hour) / 1000;

// Sunday 18 October 2026, 3 PM in Honolulu.
const sundayAfternoon = utc(10, 19, 1);

describe('Honolulu time labels', () => {
  it('formats the hour of day in Honolulu', () => {
    expect(hourLabel(sundayAfternoon)).toMatch(/^3\sPM$/);
    expect(hourLabel(utc(10, 18, 10))).toMatch(/^12\sAM$/);
  });

  it('formats the weekday in Honolulu, not UTC', () => {
    expect(weekdayLabel(sundayAfternoon)).toBe('Sun');
  });

  it('formats the weekday and day of the month', () => {
    expect(dayLabel(sundayAfternoon)).toBe('Sun 18');
  });

  it('formats the weekday and hour', () => {
    expect(timeLabel(sundayAfternoon)).toMatch(/^Sun 3\sPM$/);
  });

  it('formats a span of hours', () => {
    const nineAm = utc(10, 18, 19);
    expect(hourRangeLabel(nineAm, nineAm + 3 * 3600)).toMatch(/^Sun 9\sAM–12\sPM$/);
  });

  it('keys dates by the Honolulu calendar day', () => {
    expect(dateKey(sundayAfternoon)).toBe('2026-10-18');
    expect(dateKey(utc(10, 19, 9) + 3599)).toBe('2026-10-18');
    expect(dateKey(utc(10, 19, 10))).toBe('2026-10-19');
  });
});
