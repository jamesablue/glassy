import { currentHourIndex, groupHoursByDay, hourIndexAt, nightRuns, nowPosition } from './timeline';

const HOUR = 3600;
const hourly = (start: number, count: number): number[] =>
  Array.from({ length: count }, (_, i) => start + i * HOUR);

describe('currentHourIndex', () => {
  const times = hourly(0, 3);

  it('finds the hour that contains now', () => {
    expect(currentHourIndex(times, 0)).toBe(0);
    expect(currentHourIndex(times, 1800)).toBe(0);
    expect(currentHourIndex(times, HOUR)).toBe(1);
    expect(currentHourIndex(times, 2 * HOUR - 1)).toBe(1);
  });

  it('falls back to the first hour before the forecast starts', () => {
    expect(currentHourIndex(times, -60)).toBe(0);
  });

  it('falls back to the first hour once no forecast hour is left to start', () => {
    expect(currentHourIndex(times, 2 * HOUR)).toBe(0);
    expect(currentHourIndex(times, 10 * HOUR)).toBe(0);
  });

  it('handles an empty forecast', () => {
    expect(currentHourIndex([], 0)).toBe(0);
  });
});

describe('hourIndexAt', () => {
  const times = hourly(0, 3);

  it('finds the hour that contains the time', () => {
    expect(hourIndexAt(times, 0)).toBe(0);
    expect(hourIndexAt(times, HOUR + 1800)).toBe(1);
    expect(hourIndexAt(times, 2 * HOUR)).toBe(2);
  });

  it('clamps times outside the forecast to its first and last hours', () => {
    expect(hourIndexAt(times, -10 * HOUR)).toBe(0);
    expect(hourIndexAt(times, 10 * HOUR)).toBe(2);
  });

  it('handles an empty forecast', () => {
    expect(hourIndexAt([], 0)).toBe(0);
  });
});

describe('nowPosition', () => {
  const times = hourly(0, 3);

  it('adds how far through the current hour now is', () => {
    expect(nowPosition(times, 1800)).toBe(0.5);
    expect(nowPosition(times, HOUR + 900)).toBe(1.25);
  });

  it('stays within the fallback hour when now is outside the forecast', () => {
    expect(nowPosition(times, -HOUR)).toBe(0);
    expect(nowPosition(times, 10 * HOUR)).toBe(1);
  });

  it('is 0 for an empty forecast', () => {
    expect(nowPosition([], 1234)).toBe(0);
  });
});

describe('groupHoursByDay', () => {
  it('starts a new day at midnight in Honolulu', () => {
    // 22:00 Saturday 17 October to 02:00 Sunday 18 October, Honolulu time.
    const times = hourly(Date.UTC(2026, 9, 18, 8) / 1000, 5);
    expect(groupHoursByDay(times)).toEqual([
      { dateKey: '2026-10-17', label: 'Sat 17', start: 0, count: 2 },
      { dateKey: '2026-10-18', label: 'Sun 18', start: 2, count: 3 },
    ]);
  });

  it('does not split the day at midnight UTC', () => {
    // 12:00 to 16:00 Sunday in Honolulu spans 00:00 UTC Monday.
    const times = hourly(Date.UTC(2026, 9, 18, 22) / 1000, 5);
    expect(groupHoursByDay(times)).toEqual([
      { dateKey: '2026-10-18', label: 'Sun 18', start: 0, count: 5 },
    ]);
  });

  it('covers every hour of a multi-day forecast', () => {
    const days = groupHoursByDay(hourly(Date.UTC(2026, 9, 18, 10) / 1000, 120));
    expect(days.map((day) => day.count)).toEqual([24, 24, 24, 24, 24]);
    expect(days.map((day) => day.start)).toEqual([0, 24, 48, 72, 96]);
  });

  it('returns no days for an empty forecast', () => {
    expect(groupHoursByDay([])).toEqual([]);
  });
});

describe('nightRuns', () => {
  it('finds each run of night hours', () => {
    expect(nightRuns([true, false, false, true, true, false])).toEqual([
      { start: 1, count: 2 },
      { start: 5, count: 1 },
    ]);
  });

  it('includes a night at the start of the forecast', () => {
    expect(nightRuns([false, false, true])).toEqual([{ start: 0, count: 2 }]);
  });

  it('handles all-day, all-night and empty forecasts', () => {
    expect(nightRuns([true, true])).toEqual([]);
    expect(nightRuns([false, false])).toEqual([{ start: 0, count: 2 }]);
    expect(nightRuns([])).toEqual([]);
  });
});
