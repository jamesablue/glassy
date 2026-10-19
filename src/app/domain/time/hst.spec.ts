import {
  dateKey,
  dayLabel,
  hourKey,
  hourLabel,
  hourRangeLabel,
  parseHourKey,
  timeLabel,
  weekdayLabel,
} from './hst';

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

describe('hour keys', () => {
  const eightAm = utc(10, 20, 18);

  it('names the Honolulu hour, not the UTC one', () => {
    expect(hourKey(eightAm)).toBe('2026-10-20T08');
    expect(hourKey(eightAm + 3599)).toBe('2026-10-20T08');
    // 11 PM in Honolulu is already the next day in UTC.
    expect(hourKey(utc(10, 21, 9))).toBe('2026-10-20T23');
  });

  it('parses a key back to the start of its hour', () => {
    expect(parseHourKey('2026-10-20T08')).toBe(eightAm);
    expect(parseHourKey('2026-10-20T23')).toBe(utc(10, 21, 9));
    expect(parseHourKey(hourKey(eightAm + 1234))).toBe(eightAm);
  });

  it.each([
    '',
    'now',
    '2026-10-20',
    '2026-10-20T8',
    '2026-10-20T08:00',
    ' 2026-10-20T08',
    '2026-13-01T08',
    '2026-02-30T08',
    '2026-10-20T24',
    '0050-01-01T00',
  ])('rejects %j', (key) => {
    expect(parseHourKey(key)).toBeNull();
  });
});
