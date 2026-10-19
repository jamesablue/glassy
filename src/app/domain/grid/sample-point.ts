import type { GridForecast, PointSample, VectorField } from '../models';
import { bilinear } from './bilinear';
import { gridPosition } from './grid-position';
import { directionFromVector } from './vector-field';

/** Points further than this outside the grid (in cells) have no forecast. */
export const MAX_CELLS_OUTSIDE = 0.5;

/**
 * The forecast at any map point and hour, interpolated from the grid, or `null` when the point is
 * more than half a cell outside it. Directions are rebuilt from interpolated u/v vectors instead of
 * interpolating angles, so 350° and 10° blend to 0° rather than 180°.
 */
export function samplePoint(
  grid: GridForecast,
  hour: number,
  lat: number,
  lon: number,
): PointSample | null {
  const { row, col, outside } = gridPosition(grid.spec, lat, lon);
  if (outside > MAX_CELLS_OUTSIDE) return null;

  const at = (values: ArrayLike<number>): number => bilinear(grid.spec, values, hour, row, col);
  const directionOf = (field: VectorField): number => directionFromVector(at(field.u), at(field.v));
  const { fields, vectors } = grid;

  return {
    windSpeed: at(fields.windSpeed),
    windDirection: directionOf(vectors.wind),
    waveHeight: at(fields.waveHeight),
    wavePeriod: at(fields.wavePeriod),
    waveDirection: directionOf(vectors.waves),
    swellHeight: at(fields.swellHeight),
    swellPeriod: at(fields.swellPeriod),
    swellDirection: directionOf(vectors.swell),
  };
}
