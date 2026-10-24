import {
  catalogFingerprint,
  encodeSeries,
  GRID_VARIABLES,
  OPEN_METEO_SOURCE,
  SNAPSHOT_FORMAT_VERSION,
  SPOT_VARIABLES,
  type EncodedSeries,
  type ForecastSnapshot,
  type GridSpec,
  type GridVariable,
  type SpotVariable,
} from '@glassy/shared';
import { OAHU_SPOTS } from '../../domain/spots';
import { decodeSnapshot } from './snapshot.decoder';

describe('decodeSnapshot', () => {
  const spots = OAHU_SPOTS.slice(0, 2);
  const grid: GridSpec = { lat0: 21, lon0: -158, step: 0.5, rows: 1, cols: 2 };
  const times = [1_800_000_000, 1_800_003_600];

  function snapshot(
    spotValues: Partial<Record<SpotVariable, (number | null)[]>> = {},
    gridValues: Partial<Record<GridVariable, (number | null)[]>> = {},
  ): ForecastSnapshot {
    const encode = (values: (number | null)[] | undefined): EncodedSeries =>
      encodeSeries(values ?? [1, 2, 3, 4], 2, 2);
    return {
      formatVersion: SNAPSHOT_FORMAT_VERSION,
      fetchedAt: '2027-01-15T08:00:00.000Z',
      source: OPEN_METEO_SOURCE,
      catalogFingerprint: catalogFingerprint(spots),
      times,
      spots: {
        ids: spots.map((spot) => spot.id),
        series: Object.fromEntries(
          SPOT_VARIABLES.map((name) => [name, encode(spotValues[name])]),
        ) as Record<SpotVariable, EncodedSeries>,
      },
      grid: {
        spec: grid,
        fields: Object.fromEntries(
          GRID_VARIABLES.map((name) => [name, encode(gridValues[name])]),
        ) as Record<GridVariable, EncodedSeries>,
      },
    };
  }

  it('lays the spot series out hour by hour, NaN where missing', () => {
    const bundle = decodeSnapshot(snapshot({ seaLevel: [0.42, -0.1, null, -0.12] }));
    expect(bundle.spots.spotCount).toBe(2);
    expect(bundle.spots.hourCount).toBe(2);
    expect(Array.from(bundle.spots.series.seaLevel)).toEqual([
      Math.fround(0.42),
      Math.fround(-0.1),
      NaN,
      Math.fround(-0.12),
    ]);
  });

  it('takes the island daylight from the first spot', () => {
    const bundle = decodeSnapshot(snapshot({ isDay: [1, 0, 0, 1] }));
    expect(bundle.times).toEqual(times);
    expect(bundle.isDay).toEqual([true, false]);
  });

  it('builds the map fields and the vectors from speed or period and direction', () => {
    const bundle = decodeSnapshot(
      snapshot({}, { windSpeed: [5, 0, 5, 0], windDirection: [90, 0, 270, 0] }),
    );
    expect(Array.from(bundle.grid.fields.windSpeed)).toEqual([5, 0, 5, 0]);
    expect(bundle.grid.spec).toEqual(grid);
    // From the east, the wind blows west (u < 0); from the west, it blows east.
    expect(bundle.grid.vectors.wind.u[0]).toBeLessThan(0);
    expect(bundle.grid.vectors.wind.u[2]).toBeGreaterThan(0);
  });
});
