import {
  SPOT_VARIABLES,
  type SpotForecast,
  type SpotVariable,
} from '../app/domain/models/forecast';

/** Shape of `fixtures/spot-forecast.fixture.json`, written by `scripts/record-fixtures.ts`. */
export interface SpotForecastFixture {
  readonly recordedAt: string;
  readonly spotIds: readonly string[];
  /** Start of each recorded hour, Unix seconds. */
  readonly times: readonly number[];
  /** `series[variable][spotIndex][hour]`, `null` where the model had no value. */
  readonly series: Readonly<Record<SpotVariable, readonly (readonly (number | null)[])[]>>;
}

/**
 * Packs per-spot values into the domain's `SpotForecast` layout (32-bit floats, `NaN` for missing
 * values), the same way the data layer packs API responses.
 */
export function buildSpotForecast(
  spotCount: number,
  hourCount: number,
  valueOf: (variable: SpotVariable, spotIndex: number, hour: number) => number | null,
): SpotForecast {
  const pack = (variable: SpotVariable): Float32Array => {
    const values = new Float32Array(spotCount * hourCount);
    for (let hour = 0; hour < hourCount; hour++) {
      for (let spot = 0; spot < spotCount; spot++) {
        values[hour * spotCount + spot] = valueOf(variable, spot, hour) ?? NaN;
      }
    }
    return values;
  };
  const series = Object.fromEntries(SPOT_VARIABLES.map((variable) => [variable, pack(variable)]));
  return {
    spotCount,
    hourCount,
    series: series as Record<SpotVariable, Float32Array>,
  };
}

export function spotForecastFromFixture(fixture: SpotForecastFixture): SpotForecast {
  return buildSpotForecast(
    fixture.spotIds.length,
    fixture.times.length,
    (variable, spot, hour) => fixture.series[variable][spot]?.[hour] ?? null,
  );
}
