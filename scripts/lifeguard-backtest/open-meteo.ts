import type { LatLon } from '@glassy/shared';
import type { OpenMeteoLocation, OpenMeteoResponse } from '../../backend/src/open-meteo/types';
import { buildOpenMeteoUrl, type SpotMarineVariable } from '../../backend/src/open-meteo/urls';
import { DEFAULT_INGEST_SETTINGS } from '../../backend/src/ingest/settings';
import type { SpotHourSample, WaveComponent } from '../../src/app/domain/models';

/** The wave trains the surf estimate reads, a subset of the ingest's `SPOT_MARINE_VARS`. */
export const SURF_MARINE_VARS = [
  'swell_wave_height',
  'swell_wave_direction',
  'swell_wave_period',
  'secondary_swell_wave_height',
  'secondary_swell_wave_direction',
  'secondary_swell_wave_period',
  'wind_wave_height',
  'wind_wave_direction',
  'wind_wave_period',
] as const satisfies readonly SpotMarineVariable[];

type MarineVariable = (typeof SURF_MARINE_VARS)[number];

/**
 * Past marine values at `points`, the same way the ingest asks for them (default wave model,
 * `cell_selection=sea`), but hourly in UTC and reaching `pastDays` back. `past_days` isn't part of
 * the ingest's query, so it's appended here.
 */
export function pastMarineUrl(points: readonly LatLon[], pastDays: number): string {
  const url = buildOpenMeteoUrl(DEFAULT_INGEST_SETTINGS.openMeteoMarineUrl, {
    points,
    coordinateDecimals: 4,
    hourly: SURF_MARINE_VARS,
    forecastDays: 1,
    timeZone: 'GMT',
    cellSelection: 'sea',
  });
  return `${url}&past_days=${pastDays}`;
}

/** A point's samples by hour (Unix seconds), and the model cell Open-Meteo picked for it. */
export interface SampleSeries {
  readonly cell: LatLon;
  readonly hours: ReadonlyMap<number, SpotHourSample>;
}

/**
 * Splits a multi-location response into one series per requested point, in request order. Only
 * the wave trains are filled in: the surf estimate reads nothing else, so wind, current, tide and
 * the rest are `NaN`.
 */
export function parseMarine(response: OpenMeteoResponse<MarineVariable>): SampleSeries[] {
  const locations: readonly OpenMeteoLocation<MarineVariable>[] = Array.isArray(response)
    ? response
    : [response];
  return [...locations]
    .sort((a, b) => (a.location_id ?? 0) - (b.location_id ?? 0))
    .map((location) => {
      const { hourly } = location;
      const hours = new Map<number, SpotHourSample>();
      hourly.time.forEach((time, index) => {
        const at = (name: MarineVariable): number => hourly[name]?.[index] ?? NaN;
        const train = (prefix: 'swell' | 'secondary_swell' | 'wind'): WaveComponent => ({
          height: at(`${prefix}_wave_height`),
          period: at(`${prefix}_wave_period`),
          direction: at(`${prefix}_wave_direction`),
        });
        hours.set(time, {
          primarySwell: train('swell'),
          secondarySwell: train('secondary_swell'),
          windWaves: train('wind'),
          windSpeed: NaN,
          windDirection: NaN,
          windGust: NaN,
          currentSpeed: NaN,
          currentDirection: NaN,
          seaSurfaceTemperature: NaN,
          seaLevel: NaN,
          seaLevelNextHour: NaN,
          rainChance: NaN,
          isDay: true,
        });
      });
      return { cell: { lat: location.latitude, lon: location.longitude }, hours };
    });
}
