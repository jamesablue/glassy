import { rateScore } from '../../domain/scoring';
import type { ScoreTrendPoint } from '../../state';
import { dailySummary, TREND_CHART, trendGeometry, trendValueText } from './score-trend';

/** Midnight on Sunday 18 October 2026 in Honolulu. */
const MIDNIGHT = Date.UTC(2026, 9, 18, 10) / 1000;

/** `count` hours from midnight, daylight from 6 AM to 6 PM. */
function points(
  count: number,
  score = (hour: number) => hour % 10,
  surf = () => 0.3,
): ScoreTrendPoint[] {
  return Array.from({ length: count }, (_, hour) => ({
    hour,
    time: MIDNIGHT + hour * 3600,
    score: score(hour),
    surf: surf(),
    isDay: hour % 24 >= 6 && hour % 24 < 18,
  }));
}

describe('trendGeometry', () => {
  const plotHeight = TREND_CHART.bottom - TREND_CHART.top;

  it('draws one bar per hour, as tall as its score and coloured by its rating', () => {
    const geometry = trendGeometry(points(48));
    expect(geometry.hourCount).toBe(48);
    expect(geometry.bars).toHaveLength(48);
    const seven = geometry.bars[7];
    expect(seven?.height).toBeCloseTo((7 / 10) * plotHeight, 1);
    expect((seven?.y ?? 0) + (seven?.height ?? 0)).toBeCloseTo(TREND_CHART.bottom, 5);
    expect(seven?.color).toBe(rateScore(7).color);
    expect(seven?.x).toBeGreaterThan(7);
    expect((seven?.x ?? 0) + (seven?.width ?? 0)).toBeLessThan(8);
  });

  it('keeps a sliver for a zero or missing score', () => {
    const geometry = trendGeometry(points(2, (hour) => (hour === 0 ? 0 : NaN)));
    expect(geometry.bars.map((bar) => bar.height)).toEqual([1, 1]);
    expect(geometry.bars[1]?.color).toBe(rateScore(NaN).color);
  });

  it('marks the night hours', () => {
    const geometry = trendGeometry(points(48));
    expect(geometry.nights).toEqual([
      { start: 0, count: 6 },
      { start: 18, count: 12 },
      { start: 42, count: 6 },
    ]);
    expect(geometry.bars[3]?.isDay).toBe(false);
    expect(geometry.bars[12]?.isDay).toBe(true);
  });

  it('starts a labelled day at each midnight', () => {
    const geometry = trendGeometry(points(48));
    expect(geometry.days).toEqual([
      { start: 0, left: 0, label: 'Sun' },
      { start: 24, left: 50, label: 'Mon' },
    ]);
  });

  it('runs the surf line through the middle of each hour, the highest near the top', () => {
    const surf = [0.2, 1.5, 0.75];
    const geometry = trendGeometry(
      points(
        3,
        () => 5,
        () => 0,
      ).map((point, hour) => ({ ...point, surf: surf[hour] ?? 0 })),
    );
    expect(geometry.maxSurf).toBe(1.5);
    const coordinates = geometry.surfPath.match(/[ML][\d.]+ [\d.]+/g);
    expect(coordinates?.[0]?.startsWith('M0.5 ')).toBe(true);
    const ys = geometry.surfPath
      .split(/[ML]/)
      .filter(Boolean)
      .map((pair) => Number(pair.split(' ')[1]));
    expect(ys[1]).toBeCloseTo(TREND_CHART.bottom - plotHeight * 0.92, 1);
    expect(ys[2]).toBeCloseTo(TREND_CHART.bottom - plotHeight * 0.46, 1);
  });

  it('keeps a flat forecast low instead of stretching it to the top', () => {
    const geometry = trendGeometry(
      points(
        2,
        () => 5,
        () => 0.1,
      ),
    );
    const ys = geometry.surfPath
      .split(/[ML]/)
      .filter(Boolean)
      .map((pair) => Number(pair.split(' ')[1]));
    expect(ys[0]).toBeGreaterThan(TREND_CHART.bottom - plotHeight * 0.2);
  });
});

describe('dailySummary', () => {
  it('gives each day’s best hour, lowest score and biggest surf', () => {
    let size = 0;
    const summary = dailySummary(
      points(
        48,
        (hour) => (hour === 9 ? 8.5 : hour === 33 ? 9 : 4),
        () => (size += 0.01),
      ),
    );
    expect(summary).toEqual([
      {
        day: 'Sun 18',
        bestScore: 8.5,
        bestTime: MIDNIGHT + 9 * 3600,
        lowestScore: 4,
        maxSurf: expect.closeTo(0.24, 5),
      },
      {
        day: 'Mon 19',
        bestScore: 9,
        bestTime: MIDNIGHT + 33 * 3600,
        lowestScore: 4,
        maxSurf: expect.closeTo(0.48, 5),
      },
    ]);
  });
});

describe('trendValueText', () => {
  const hour = points(
    10,
    () => 7.44,
    () => 1,
  )[1] as ScoreTrendPoint;
  const nine = { ...hour, hour: 9, time: MIDNIGHT + 9 * 3600 };

  it('reads out an hour: when, the score and its rating, and the surf', () => {
    expect(trendValueText(nine, 'ft')).toBe('Sun 9 AM: score 7.4, Good; surf 3–4 ft');
    expect(trendValueText(nine, 'm')).toMatch(/; surf .+ m$/);
  });

  it('copes with a missing score', () => {
    expect(trendValueText({ ...nine, score: NaN }, 'ft')).toMatch(/score —, Hazardous/);
  });

  it('is empty when there is no hour to read', () => {
    expect(trendValueText(undefined, 'ft')).toBe('');
  });
});
