/**
 * Raw Open-Meteo response shapes, as requested with `timeformat=unixtime`.
 * https://open-meteo.com/en/docs and https://open-meteo.com/en/docs/marine-weather-api
 */
import type {
  GridMarineVariable,
  GridWindVariable,
  SpotMarineVariable,
  SpotWeatherVariable,
} from './open-meteo.urls';

/**
 * One location's hourly series, keyed by the requested variable names. `time` holds the start of
 * each hour in Unix seconds. A value is `null` where the model has no data (for example a marine
 * variable over land), and a variable the model does not offer may be missing altogether.
 */
export type OpenMeteoHourly<V extends string> = { readonly time: readonly number[] } & Partial<
  Readonly<Record<V, readonly (number | null)[]>>
>;

/** The forecast for one requested point. */
export interface OpenMeteoLocation<V extends string> {
  /** Centre of the model cell the API picked, which can differ from the requested point. */
  readonly latitude: number;
  readonly longitude: number;
  readonly timezone: string;
  readonly utc_offset_seconds: number;
  /** Position in the request's coordinate list. Open-Meteo omits it for the first location. */
  readonly location_id?: number;
  readonly hourly: OpenMeteoHourly<V>;
}

/**
 * A forecast response: an array with one entry per requested point, or a bare object when only one
 * point was requested.
 */
export type OpenMeteoResponse<V extends string> =
  OpenMeteoLocation<V> | readonly OpenMeteoLocation<V>[];

/** The four responses behind one forecast load (see `forecastRequestUrls`). */
export interface OpenMeteoForecastResponses {
  readonly gridMarine: OpenMeteoResponse<GridMarineVariable>;
  readonly gridWind: OpenMeteoResponse<GridWindVariable>;
  readonly spotMarine: OpenMeteoResponse<SpotMarineVariable>;
  readonly spotWeather: OpenMeteoResponse<SpotWeatherVariable>;
}

/** The JSON body Open-Meteo sends with a 4xx or 5xx status. */
export interface OpenMeteoErrorBody {
  readonly error: true;
  /** Human-readable cause, for example "Daily API request limit exceeded". */
  readonly reason: string;
}
