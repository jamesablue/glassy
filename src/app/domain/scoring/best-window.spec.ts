import { bestWindow } from './best-window';

describe('bestWindow', () => {
  const allDay = (hours: number): boolean[] => Array.from({ length: hours }, () => true);

  it('finds the three daylight hours with the best average', () => {
    const scores = [5, 5, 5, 9, 9, 9, 1, 1];
    expect(bestWindow(scores, allDay(8), 0)).toEqual({ start: 3, average: 9 });
  });

  it('skips windows that start at night', () => {
    const isDay = [false, true, true, true, true, true];
    expect(bestWindow([9, 9, 9, 5, 5, 5], isDay, 0)).toEqual({ start: 1, average: 23 / 3 });
  });

  it('skips windows that end at night', () => {
    const isDay = [true, true, true, true, true, false];
    expect(bestWindow([5, 5, 5, 9, 9, 9], isDay, 0)).toEqual({ start: 2, average: 23 / 3 });
  });

  it('only looks from the given hour on', () => {
    const scores = [9, 9, 9, 4, 5, 6, 5];
    expect(bestWindow(scores, allDay(7), 3)).toEqual({ start: 4, average: 16 / 3 });
  });

  it('keeps an earlier window unless a later one beats it by more than 0.05', () => {
    const slightlyBetter = [6, 6, 6, 6.04, 6.04, 6.04];
    expect(bestWindow(slightlyBetter, allDay(6), 0)?.start).toBe(0);

    const clearlyBetter = [6, 6, 6, 6.06, 6.06, 6.06];
    expect(bestWindow(clearlyBetter, allDay(6), 0)?.start).toBe(3);
  });

  it('keeps the first of equal windows', () => {
    expect(bestWindow([7, 7, 7, 7, 7], allDay(5), 0)?.start).toBe(0);
  });

  it('returns null when no full window fits in daylight', () => {
    expect(bestWindow([9, 9, 9, 9], [true, false, false, true], 0)).toBeNull();
    expect(bestWindow([9, 9], allDay(2), 0)).toBeNull();
    expect(bestWindow([9, 9, 9, 9], allDay(4), 2)).toBeNull();
  });

  it('reads scores from a typed array view', () => {
    const scores = Float32Array.of(2, 4, 6, 8);
    expect(bestWindow(scores, allDay(4), 0)).toEqual({ start: 1, average: 6 });
  });
});
