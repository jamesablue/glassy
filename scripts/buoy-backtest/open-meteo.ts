import type { LatLon } from '@glassy/shared';
import type { OpenMeteoLocation, OpenMeteoResponse } from '../../backend/src/open-meteo/types';
import { buildOpenMeteoUrl, type SpotMarineVariable } from '../../backend/src/open-meteo/urls';
import { DEFAULT_INGEST_SETTINGS } from '../../backend/src/ingest/settings';

/** The wave trains the backtest compares, a subset of the ingest's `SPOT_MARINE_VARS`. */
export const BACKTEST_MARINE_VARS = [
  'swell_wave_height',
  'swell_wave_direction',
  'swell_wave_period',
  'secondary_swell_wave_height',
  'secondary_swell_wave_direction',
  'wind_wave_height',
  'wind_wave_direction',
] as const satisfies readonly SpotMarineVariable[];

type MarineVariable = (typeof BACKTEST_MARINE_VARS)[number];

/**
 * Past marine values at `points`, the same way the ingest asks for them (default wave model,
 * `cell_selection=sea`), but hourly in UTC and reaching `pastDays` back. `past_days` isn't part of
 * the ingest's query, so it's appended here.
 */
export function pastMarineUrl(points: readonly LatLon[], pastDays: number): string {
  const url = buildOpenMeteoUrl(DEFAULT_INGEST_SETTINGS.openMeteoMarineUrl, {
    points,
    coordinateDecimals: 4,
    hourly: BACKTEST_MARINE_VARS,
    forecastDays: 1,
    timeZone: 'GMT',
    cellSelection: 'sea',
  });
  return `${url}&past_days=${pastDays}`;
}

/** One hour of model values at one point. A missing value is `NaN`. */
export interface ModelHour {
  readonly swellHeight: number;
  readonly swellDirection: number;
  readonly swellPeriod: number;
  readonly secondaryHeight: number;
  readonly secondaryDirection: number;
  readonly windWaveHeight: number;
  readonly windWaveDirection: number;
}

/** A point's model values by hour (Unix seconds), and the model cell Open-Meteo picked for it. */
export interface ModelSeries {
  readonly cell: LatLon;
  readonly hours: ReadonlyMap<number, ModelHour>;
}

/** Splits a multi-location response into one series per requested point, in request order. */
export function parseMarine(response: OpenMeteoResponse<MarineVariable>): ModelSeries[] {
  const locations: readonly OpenMeteoLocation<MarineVariable>[] = Array.isArray(response)
    ? response
    : [response];
  return [...locations]
    .sort((a, b) => (a.location_id ?? 0) - (b.location_id ?? 0))
    .map((location) => {
      const { hourly } = location;
      const at = (name: MarineVariable, index: number): number => hourly[name]?.[index] ?? NaN;
      const hours = new Map<number, ModelHour>();
      hourly.time.forEach((time, index) => {
        hours.set(time, {
          swellHeight: at('swell_wave_height', index),
          swellDirection: at('swell_wave_direction', index),
          swellPeriod: at('swell_wave_period', index),
          secondaryHeight: at('secondary_swell_wave_height', index),
          secondaryDirection: at('secondary_swell_wave_direction', index),
          windWaveHeight: at('wind_wave_height', index),
          windWaveDirection: at('wind_wave_direction', index),
        });
      });
      return { cell: { lat: location.latitude, lon: location.longitude }, hours };
    });
}
