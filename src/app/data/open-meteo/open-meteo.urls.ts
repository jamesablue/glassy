import type { GlassyConfig } from '../../core/glassy-config';
import { samplingPoint } from '../../domain/geo';
import { gridCellCenters } from '../../domain/grid';
import type { LatLon, Spot } from '../../domain/models';

/** Sea state on the map grid: combined sea for the waves layer, primary swell for swell and period. */
export const GRID_MARINE_VARS = [
  'wave_height',
  'wave_direction',
  'wave_period',
  'swell_wave_height',
  'swell_wave_direction',
  'swell_wave_period',
] as const;

/** Wind on the map grid. */
export const GRID_WIND_VARS = ['wind_speed_10m', 'wind_direction_10m'] as const;

/** Everything the scoring model and spot detail read from the marine model, offshore of each spot. */
export const SPOT_MARINE_VARS = [
  'swell_wave_height',
  'swell_wave_direction',
  'swell_wave_period',
  'secondary_swell_wave_height',
  'secondary_swell_wave_direction',
  'secondary_swell_wave_period',
  'wind_wave_height',
  'wind_wave_direction',
  'wind_wave_period',
  'sea_surface_temperature',
  'ocean_current_velocity',
  'ocean_current_direction',
  'sea_level_height_msl',
] as const;

/** Weather at each spot: wind for the score, gusts and rain for the detail, daylight for the timeline. */
export const SPOT_WEATHER_VARS = [
  'wind_speed_10m',
  'wind_direction_10m',
  'wind_gusts_10m',
  'is_day',
  'precipitation_probability',
] as const;

export type GridMarineVariable = (typeof GRID_MARINE_VARS)[number];
export type GridWindVariable = (typeof GRID_WIND_VARS)[number];
export type SpotMarineVariable = (typeof SPOT_MARINE_VARS)[number];
export type SpotWeatherVariable = (typeof SPOT_WEATHER_VARS)[number];

/**
 * How Open-Meteo maps a point to a model cell. `sea` picks the nearest cell with ocean data, which
 * marine requests need because the coastal cells the spots sit in are masked as land. `nearest`
 * takes the closest cell whatever it is, which keeps weather at a spot from drifting out to sea.
 */
export type CellSelection = 'land' | 'sea' | 'nearest';

export interface OpenMeteoQuery {
  readonly points: readonly LatLon[];
  /** Decimal places for coordinates. Omit to send them as they are. */
  readonly coordinateDecimals?: number;
  readonly hourly: readonly string[];
  readonly forecastDays: number;
  readonly timeZone: string;
  readonly cellSelection?: CellSelection;
  /** The API defaults to km/h; the domain works in m/s. */
  readonly windSpeedUnit?: 'ms';
}

/**
 * The URL for an hourly multi-location forecast. Times come back as Unix seconds
 * (`timeformat=unixtime`), so the client never parses local date strings, and are aligned to
 * `timeZone` so every day starts at local midnight. Values are percent-encoded one by one and lists
 * are joined with literal commas, which keeps the long coordinate lists readable.
 */
export function buildOpenMeteoUrl(baseUrl: string, query: OpenMeteoQuery): string {
  const coordinate = (value: number): string =>
    query.coordinateDecimals === undefined
      ? String(value)
      : value.toFixed(query.coordinateDecimals);
  const params: [string, readonly (string | number)[]][] = [
    ['latitude', query.points.map((point) => coordinate(point.lat))],
    ['longitude', query.points.map((point) => coordinate(point.lon))],
    ['hourly', query.hourly],
    ['forecast_days', [query.forecastDays]],
    ['timezone', [query.timeZone]],
    ['timeformat', ['unixtime']],
  ];
  if (query.windSpeedUnit) params.push(['wind_speed_unit', [query.windSpeedUnit]]);
  if (query.cellSelection) params.push(['cell_selection', [query.cellSelection]]);

  const encoded = params.map(
    ([name, values]) => `${name}=${values.map((value) => encodeURIComponent(value)).join(',')}`,
  );
  return `${baseUrl}?${encoded.join('&')}`;
}

/** The four requests behind one forecast load. */
export type ForecastRequestId = 'gridMarine' | 'gridWind' | 'spotMarine' | 'spotWeather';

export type ForecastRequestSettings = Pick<
  GlassyConfig,
  | 'openMeteoMarineUrl'
  | 'openMeteoForecastUrl'
  | 'grid'
  | 'forecastDays'
  | 'timeZone'
  | 'offshoreDistanceKm'
>;

/**
 * Every URL one forecast load fetches. Grid points are listed in field order (see
 * `gridCellCenters`) and spot points in catalog order, so response locations line up with the
 * domain's packed layouts. The app and the fixture recorder both build their requests here, so
 * recorded responses match the app's URLs exactly.
 */
export function forecastRequestUrls(
  settings: ForecastRequestSettings,
  spots: readonly Spot[],
): Readonly<Record<ForecastRequestId, string>> {
  const common = { forecastDays: settings.forecastDays, timeZone: settings.timeZone };
  const gridPoints = gridCellCenters(settings.grid);

  return {
    gridMarine: buildOpenMeteoUrl(settings.openMeteoMarineUrl, {
      ...common,
      points: gridPoints,
      coordinateDecimals: 3,
      hourly: GRID_MARINE_VARS,
      cellSelection: 'sea',
    }),
    gridWind: buildOpenMeteoUrl(settings.openMeteoForecastUrl, {
      ...common,
      points: gridPoints,
      coordinateDecimals: 3,
      hourly: GRID_WIND_VARS,
      windSpeedUnit: 'ms',
    }),
    spotMarine: buildOpenMeteoUrl(settings.openMeteoMarineUrl, {
      ...common,
      points: spots.map((spot) => samplingPoint(spot, settings.offshoreDistanceKm)),
      coordinateDecimals: 4,
      hourly: SPOT_MARINE_VARS,
      cellSelection: 'sea',
    }),
    spotWeather: buildOpenMeteoUrl(settings.openMeteoForecastUrl, {
      ...common,
      points: spots,
      hourly: SPOT_WEATHER_VARS,
      windSpeedUnit: 'ms',
      cellSelection: 'nearest',
    }),
  };
}
