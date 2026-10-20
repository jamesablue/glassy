import { OFFSHORE_DISTANCE_KM } from '../domain/geo';
import { OAHU_GRID } from '../domain/grid';
import type { GridSpec } from '../domain/models';
import { HONOLULU_TIME_ZONE } from '../domain/time';

/**
 * App-wide settings for where the forecast comes from and how long it is kept.
 * Plain data with no Angular imports, so Node scripts (the fixture recorder) build exactly the
 * same requests as the app.
 */
export interface GlassyConfig {
  /** Open-Meteo Marine API: waves, swell, currents, sea temperature and sea level. */
  readonly openMeteoMarineUrl: string;
  /** Open-Meteo Forecast API: wind, gusts, rain chance and daylight. */
  readonly openMeteoForecastUrl: string;
  /** NOAA NCEI DEM mosaic ImageServer: depth tiles and point depths. */
  readonly noaaDemUrl: string;
  /** The grid the map layers and particles are drawn from. */
  readonly grid: GridSpec;
  readonly forecastDays: number;
  /** IANA time zone the hourly forecast is aligned to. */
  readonly timeZone: string;
  /** A cached forecast younger than this is used without asking the network, ms. */
  readonly cacheLifetimeMs: number;
  /**
   * When no fresh copy is cached, a cached forecast younger than this is shown at once while it is
   * refreshed in the background, and kept when the refresh fails, ms.
   */
  readonly cacheMaxStaleMs: number;
  /**
   * How long each forecast request may take, retries included, before the app stops waiting for
   * it, ms. The requests run in parallel, so this is also the longest a load waits on the network.
   */
  readonly forecastRequestTimeoutMs: number;
  /** How far out to sea marine values are read for each spot, km (see `offshorePoint`). */
  readonly offshoreDistanceKm: number;
}

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;

export const DEFAULT_GLASSY_CONFIG: GlassyConfig = {
  openMeteoMarineUrl: 'https://marine-api.open-meteo.com/v1/marine',
  openMeteoForecastUrl: 'https://api.open-meteo.com/v1/forecast',
  noaaDemUrl: 'https://gis.ngdc.noaa.gov/arcgis/rest/services/DEM_mosaics/DEM_all/ImageServer',
  grid: OAHU_GRID,
  forecastDays: 5,
  timeZone: HONOLULU_TIME_ZONE,
  cacheLifetimeMs: 45 * MINUTE_MS,
  cacheMaxStaleMs: 12 * HOUR_MS,
  // Open-Meteo usually answers within a few seconds, and has been seen to take about a minute.
  forecastRequestTimeoutMs: 25_000,
  offshoreDistanceKm: OFFSHORE_DISTANCE_KM,
};
