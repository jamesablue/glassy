import { OAHU_GRID, OAHU_SPOTS, type Spot } from '@glassy/shared';
import type { FetchSettings } from '../open-meteo/client';
import type { ForecastRequestSettings } from '../open-meteo/urls';

/** Everything one ingest run needs to know: what to request, for which spots, and how patiently. */
export interface IngestSettings extends ForecastRequestSettings, FetchSettings {
  /** The catalog the spot requests are made for, in the order the snapshot stores them. */
  readonly spots: readonly Spot[];
}

export const DEFAULT_INGEST_SETTINGS: IngestSettings = {
  openMeteoMarineUrl: 'https://marine-api.open-meteo.com/v1/marine',
  openMeteoForecastUrl: 'https://api.open-meteo.com/v1/forecast',
  grid: OAHU_GRID,
  spots: OAHU_SPOTS,
  forecastDays: 5,
  timeZone: 'Pacific/Honolulu',
  offshoreDistanceKm: 6,
  // Open-Meteo usually answers within a few seconds, and has been seen to take about a minute.
  timeoutMs: 60_000,
  // One retry: a retry of a grid request costs another 165 weighted calls.
  retry: { retries: 1, initialDelayMs: 2_000 },
};
