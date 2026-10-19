import type { HeightUnit, SpeedUnit } from '../models';

/**
 * Legend tick values in each display unit. They are round numbers in that unit (not converted
 * from one set), spaced closer where conditions change fastest.
 */
export const LEGEND_TICKS: {
  readonly speed: Readonly<Record<SpeedUnit, readonly number[]>>;
  readonly height: Readonly<Record<HeightUnit, readonly number[]>>;
  readonly period: readonly number[];
} = {
  speed: {
    kt: [0, 5, 10, 15, 20, 25, 30, 40, 50],
    mph: [0, 5, 10, 15, 20, 30, 40, 50, 60],
    kmh: [0, 10, 20, 30, 40, 50, 60, 80, 100],
    ms: [0, 2, 4, 6, 8, 10, 14, 18, 25],
  },
  height: {
    ft: [0, 1, 2, 3, 4, 6, 8, 10, 15, 20, 30],
    m: [0, 0.3, 0.6, 1, 1.5, 2, 3, 4, 5, 6.5, 8],
  },
  period: [0, 4, 6, 8, 10, 12, 14, 16, 18, 20],
};
