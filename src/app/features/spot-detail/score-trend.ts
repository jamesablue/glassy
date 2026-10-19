import { rateScore } from '../../domain/scoring';
import {
  dayLabel,
  groupHoursByDay,
  nightRuns,
  weekdayLabel,
  type HourRun,
} from '../../domain/time';
import type { ScoreTrendPoint } from '../../state';
import { hourPercent } from '../timeline/timeline-geometry';

/**
 * The chart's drawing area. x runs in hours (one unit per forecast hour, stretched to the chart's
 * width) and y in CSS pixels, so bars stay crisp at any width while text sits outside the SVG.
 */
export const TREND_CHART = {
  height: 120,
  /** Room above the bars for the "surf max" label. */
  top: 16,
  /** The bars' baseline; the day labels sit below it. */
  bottom: 102,
} as const;

const PLOT_HEIGHT = TREND_CHART.bottom - TREND_CHART.top;
/** Space either side of a bar, in hours. */
const BAR_GAP = 0.08;
/** Even a zero score shows a sliver, so every hour has a bar. */
const MIN_BAR_HEIGHT = 1;
const MAX_SCORE = 10;
/** The surf line is scaled to at least this height (metres), so a flat week stays flat. */
const SURF_SCALE_FLOOR = 0.6;
/** The highest surf reaches this share of the plot, leaving the top for the label. */
const SURF_HEADROOM = 0.92;

export interface TrendBar {
  readonly hour: number;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  /** The score's rating colour. */
  readonly color: string;
  readonly isDay: boolean;
}

export interface TrendDay {
  /** Index of the day's first hour. */
  readonly start: number;
  /** Where the day starts, as a percentage of the chart's width. */
  readonly left: number;
  /** Short weekday, for example "Sun". */
  readonly label: string;
}

export interface TrendGeometry {
  readonly hourCount: number;
  readonly bars: readonly TrendBar[];
  readonly nights: readonly HourRun[];
  /** The surf line through the middle of each hour, as SVG path data. */
  readonly surfPath: string;
  readonly days: readonly TrendDay[];
  /** The highest surf in the forecast, metres. */
  readonly maxSurf: number;
}

/** One forecast day in words, for readers who cannot see the chart. */
export interface TrendDaySummary {
  /** For example "Sun 18". */
  readonly day: string;
  readonly bestScore: number;
  /** Start of the day's best hour, Unix seconds. */
  readonly bestTime: number;
  readonly lowestScore: number;
  /** The day's highest surf, metres. */
  readonly maxSurf: number;
}

/**
 * Everything the score trend chart draws for a spot: a bar per hour coloured by rating, the night
 * runs, the surf line, and where each day starts.
 */
export function trendGeometry(points: readonly ScoreTrendPoint[]): TrendGeometry {
  const hourCount = points.length;
  const times = points.map((point) => point.time);
  const maxSurf = Math.max(0, ...points.map((point) => point.surf).filter(Number.isFinite));
  const surfScale = Math.max(SURF_SCALE_FLOOR, maxSurf);
  const surfY = (surf: number): number =>
    round(TREND_CHART.bottom - (surf / surfScale) * PLOT_HEIGHT * SURF_HEADROOM);

  return {
    hourCount,
    bars: points.map((point, hour) => {
      const score = Number.isFinite(point.score) ? point.score : 0;
      const height = round(Math.max(MIN_BAR_HEIGHT, (score / MAX_SCORE) * PLOT_HEIGHT));
      return {
        hour,
        x: hour + BAR_GAP,
        y: round(TREND_CHART.bottom - height),
        width: 1 - 2 * BAR_GAP,
        height,
        color: rateScore(point.score).color,
        isDay: point.isDay,
      };
    }),
    nights: nightRuns(points.map((point) => point.isDay)),
    surfPath: points
      .map((point, hour) => `${hour === 0 ? 'M' : 'L'}${hour + 0.5} ${surfY(point.surf)}`)
      .join(''),
    days: groupHoursByDay(times).flatMap(({ start }) => {
      const time = times[start];
      if (time === undefined) return [];
      return [{ start, left: hourPercent(start, hourCount), label: weekdayLabel(time) }];
    }),
    maxSurf,
  };
}

/** Each forecast day's best and lowest score and highest surf. Ties go to the earlier hour. */
export function dailySummary(points: readonly ScoreTrendPoint[]): TrendDaySummary[] {
  return groupHoursByDay(points.map((point) => point.time)).map(({ start, count }) => {
    const day = points.slice(start, start + count);
    const best = day.reduce((a, b) => (b.score > a.score ? b : a));
    return {
      day: dayLabel(best.time),
      bestScore: best.score,
      bestTime: best.time,
      lowestScore: Math.min(...day.map((point) => point.score)),
      maxSurf: Math.max(...day.map((point) => point.surf)),
    };
  });
}

/** Two decimals are plenty for coordinates a few hundred pixels across. */
function round(value: number): number {
  return Math.round(value * 100) / 100;
}
