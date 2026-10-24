/** Builders for the backend's tests. The app's own builders live in src/testing/. */
import type { Spot } from '@glassy/shared';
import type { OpenMeteoHourly, OpenMeteoLocation } from '../open-meteo/types';

export function testSpot(overrides: Partial<Spot> = {}): Spot {
  return {
    id: 'test-cove',
    name: 'Test Cove',
    region: 'South Shore',
    lat: 21.27,
    lon: -157.75,
    facing: 180,
    window: 80,
    shelter: 0,
    level: 'Beginner',
    notes: 'A spot that only exists in tests.',
    ...overrides,
  };
}

/** Consecutive hours from `start` (Unix seconds). */
export function hourlyTimes(start: number, count: number): number[] {
  return Array.from({ length: count }, (_, hour) => start + hour * 3600);
}

/** One location of an Open-Meteo response with the given hourly series. */
export function openMeteoLocation<V extends string>(
  hourly: OpenMeteoHourly<V>,
  locationId?: number,
): OpenMeteoLocation<V> {
  return {
    latitude: 21.3,
    longitude: -157.8,
    timezone: 'Pacific/Honolulu',
    utc_offset_seconds: -36000,
    ...(locationId === undefined ? {} : { location_id: locationId }),
    hourly,
  };
}

/**
 * A multi-location response where every value encodes where it came from, so a test can tell
 * which variable, location and hour ended up where: `variableIndex * 1000 + location * 100 + hour`.
 */
export function codedResponse<V extends string>(
  variables: readonly V[],
  locationCount: number,
  times: readonly number[],
): OpenMeteoLocation<V>[] {
  return Array.from({ length: locationCount }, (_, location) => {
    const series: Partial<Record<V, readonly number[]>> = {};
    variables.forEach((variable, v) => {
      series[variable] = times.map((_, hour) => valueCode(v, location, hour));
    });
    return openMeteoLocation<V>({ ...series, time: times }, location === 0 ? undefined : location);
  });
}

export function valueCode(variableIndex: number, location: number, hour: number): number {
  return variableIndex * 1000 + location * 100 + hour;
}
