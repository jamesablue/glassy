import { asSpot, type Buoy } from './buoys';
import { metrics, sectorOf, type Metrics, type Pair, type Sector } from './metrics';
import type { BuoyHour } from './ndbc';
import type { ModelHour, ModelSeries } from './open-meteo';
import { predictHeight, type Trains } from './predict';

/** The three ways of predicting the buoy, by where the model is read and who does the blocking. */
export const METHODS = ['A', 'B', 'today'] as const;
export type Method = (typeof METHODS)[number];

/** Everything known about one buoy: its readings and the model at each method's point. */
export interface BuoyData {
  readonly buoy: Buoy;
  readonly hours: readonly BuoyHour[];
  readonly model: Readonly<Record<Method, ModelSeries>>;
}

/** Exposure geometry for B that differs from the buoy's own, for the sensitivity table. */
export interface GeometryShift {
  readonly facing: number;
  readonly window: number;
}

const NO_SHIFT: GeometryShift = { facing: 0, window: 0 };

/** One hour at one buoy where every method has a prediction. */
export interface Row {
  readonly buoyId: string;
  readonly time: number;
  /** Sector of the swell direction the buoy measured, or undefined when it has none. */
  readonly sector: Sector | undefined;
  readonly pairs: Readonly<Record<Method, Pair>>;
}

function predict(
  data: BuoyData,
  method: Method,
  hour: ModelHour,
  trains: Trains,
  shift: GeometryShift,
): number {
  if (method === 'A') return predictHeight(hour, trains);
  const geometry =
    method === 'B'
      ? { facing: data.buoy.facing + shift.facing, window: data.buoy.window + shift.window }
      : {};
  return predictHeight(hour, trains, asSpot(data.buoy, geometry));
}

/**
 * The hours from `start` on where the buoy measured the compared height and all three methods
 * have a model value, so every method is scored on the same hours. `swell` compares with the
 * buoy's swell height, `all` with its total height.
 */
export function rows(
  data: BuoyData,
  start: number,
  trains: Trains,
  shift: GeometryShift = NO_SHIFT,
): Row[] {
  const result: Row[] = [];
  for (const hour of data.hours) {
    const observed = trains === 'swell' ? hour.swellHeight : hour.waveHeight;
    if (hour.time < start || !Number.isFinite(observed)) continue;
    const model = METHODS.map((method) => data.model[method].hours.get(hour.time));
    const predicted = METHODS.map((method, index) => {
      const modelHour = model[index];
      return modelHour ? predict(data, method, modelHour, trains, shift) : NaN;
    });
    if (!predicted.every(Number.isFinite)) continue;
    const pairs = Object.fromEntries(
      METHODS.map((method, index) => [
        method,
        {
          observed,
          predicted: predicted[index] as number,
          observedDirection: hour.swellDirection,
          predictedDirection: model[index]?.swellDirection ?? NaN,
        },
      ]),
    ) as Record<Method, Pair>;
    result.push({
      buoyId: data.buoy.id,
      time: hour.time,
      sector: Number.isFinite(hour.swellDirection) ? sectorOf(hour.swellDirection) : undefined,
      pairs,
    });
  }
  return result;
}

/** Each method's metrics over `rows`. */
export function metricsByMethod(selected: readonly Row[]): Record<Method, Metrics> {
  return Object.fromEntries(
    METHODS.map((method) => [method, metrics(selected.map((row) => row.pairs[method]))]),
  ) as Record<Method, Metrics>;
}
