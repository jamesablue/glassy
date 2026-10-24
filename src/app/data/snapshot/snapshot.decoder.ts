import {
  decodeSeries,
  GRID_VARIABLES,
  type ForecastSnapshot,
  type GridVariable,
} from '@glassy/shared';
import { toVectorField } from '../../domain/grid';
import { valueAt } from '../../domain/math';
import {
  SPOT_VARIABLES,
  type ForecastBundle,
  type GridForecast,
  type SpotForecast,
} from '../../domain/models';

/**
 * Turns a snapshot into the domain's {@link ForecastBundle}: the spot series for the scoring model,
 * grid fields and particle vectors for the map, and an island-wide daylight flag. It gives the same
 * bundle the Open-Meteo adapter builds from the four responses the snapshot was made from.
 *
 * @param snapshot a snapshot `parseSnapshot` has accepted for the app's catalog and grid
 */
export function decodeSnapshot(snapshot: ForecastSnapshot): ForecastBundle {
  const spots = toSpotForecast(snapshot);
  return {
    times: snapshot.times,
    // Daylight per hour, read at the first spot (sunrise varies by a minute or two across Oahu).
    isDay: snapshot.times.map(
      (_, hour) => valueAt(spots.series.isDay, hour * spots.spotCount) > 0.5,
    ),
    spots,
    grid: toGridForecast(snapshot),
  };
}

function toSpotForecast(snapshot: ForecastSnapshot): SpotForecast {
  const spotCount = snapshot.spots.ids.length;
  return {
    spotCount,
    hourCount: snapshot.times.length,
    series: recordFrom(SPOT_VARIABLES, (name) =>
      decodeSeries(snapshot.spots.series[name], spotCount),
    ),
  };
}

function toGridForecast(snapshot: ForecastSnapshot): GridForecast {
  const { spec } = snapshot.grid;
  const field = recordFrom(GRID_VARIABLES, (name: GridVariable) =>
    decodeSeries(snapshot.grid.fields[name], spec.rows * spec.cols),
  );
  return {
    spec,
    fields: {
      windSpeed: field.windSpeed,
      waveHeight: field.waveHeight,
      wavePeriod: field.wavePeriod,
      swellHeight: field.swellHeight,
      swellPeriod: field.swellPeriod,
    },
    vectors: {
      wind: toVectorField(field.windSpeed, field.windDirection),
      // Wave groups travel at a speed proportional to their period, so the period sets the pace.
      waves: toVectorField(field.wavePeriod, field.waveDirection),
      swell: toVectorField(field.swellPeriod, field.swellDirection),
    },
  };
}

/** A record with one entry per key. `Object.fromEntries` loses the key type, hence the cast. */
function recordFrom<K extends string, T>(keys: readonly K[], valueOf: (key: K) => T): Record<K, T> {
  return Object.fromEntries(keys.map((key) => [key, valueOf(key)])) as Record<K, T>;
}
