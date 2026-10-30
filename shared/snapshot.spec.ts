import { catalogFingerprint, catalogFingerprintV1 } from './catalog-fingerprint';
import type { GridSpec } from './grid';
import { encodeSeries, type EncodedSeries } from './series-codec';
import {
  OPEN_METEO_SOURCE,
  parseSnapshot,
  SNAPSHOT_FORMAT_VERSION,
  SnapshotError,
  type ForecastSnapshot,
  type SnapshotErrorCode,
} from './snapshot';
import { OAHU_SPOTS, type Spot } from './spots';
import { GRID_VARIABLES, SPOT_VARIABLES, type GridVariable, type SpotVariable } from './variables';

/** A snapshot as parsed JSON, loosely typed so tests can break it. */
interface SnapshotJson {
  [key: string]: unknown;
  source: Record<string, unknown>;
  times: number[];
  spots: { ids: string[]; series: Record<string, { decimals: unknown; deltas: unknown[] }> };
  grid: {
    spec: Record<string, unknown>;
    fields: Record<string, { decimals: unknown; deltas: unknown[] }>;
  };
}

describe('parseSnapshot', () => {
  const spots = OAHU_SPOTS.slice(0, 2) as readonly Spot[];
  const grid: GridSpec = { lat0: 21, lon0: -158, step: 0.5, rows: 1, cols: 3 };
  const expected = { spots, grid };
  const times = [1_800_000_000, 1_800_003_600];

  function snapshot(): ForecastSnapshot {
    return {
      formatVersion: SNAPSHOT_FORMAT_VERSION,
      fetchedAt: '2027-01-15T08:00:00.000Z',
      source: OPEN_METEO_SOURCE,
      catalogFingerprint: catalogFingerprint(spots),
      times,
      spots: {
        ids: spots.map((spot) => spot.id),
        series: Object.fromEntries(
          SPOT_VARIABLES.map((name) => [name, encodeSeries([1, 2, null, 4], spots.length, 1)]),
        ) as Record<SpotVariable, EncodedSeries>,
      },
      grid: {
        spec: grid,
        fields: Object.fromEntries(
          GRID_VARIABLES.map((name) => [name, encodeSeries([1, 2, 3, 4, 5, null], 3, 2)]),
        ) as Record<GridVariable, EncodedSeries>,
      },
    };
  }

  /** A JSON copy of a snapshot with one change made to it. */
  function changed(change: (json: SnapshotJson) => unknown): unknown {
    const json = JSON.parse(JSON.stringify(snapshot()));
    change(json);
    return json;
  }

  function codeOf(json: unknown): SnapshotErrorCode | undefined {
    try {
      parseSnapshot(json, expected);
      return undefined;
    } catch (error) {
      expect(error).toBeInstanceOf(SnapshotError);
      return (error as SnapshotError).code;
    }
  }

  it('accepts a snapshot made for the expected catalog and grid', () => {
    const json = JSON.parse(JSON.stringify(snapshot()));
    expect(parseSnapshot(json, expected)).toEqual(snapshot());
  });

  it('writes format version 2', () => {
    expect(SNAPSHOT_FORMAT_VERSION).toBe(2);
  });

  it('accepts a version 1 snapshot carrying the version 1 fingerprint', () => {
    const json = changed((json) => {
      json['formatVersion'] = 1;
      json['catalogFingerprint'] = catalogFingerprintV1(spots);
    });
    expect(parseSnapshot(json, expected).formatVersion).toBe(1);
  });

  it.each([
    ['a version 1 snapshot with the version 2 fingerprint', 1, catalogFingerprint],
    ['a version 2 snapshot with the version 1 fingerprint', 2, catalogFingerprintV1],
  ])('refuses %s', (_, version, fingerprint) => {
    // The two fingerprints differ for these spots, since both set a sample point.
    expect(catalogFingerprintV1(spots)).not.toBe(catalogFingerprint(spots));
    const json = changed((json) => {
      json['formatVersion'] = version;
      json['catalogFingerprint'] = fingerprint(spots);
    });
    expect(codeOf(json)).toBe('catalog-mismatch');
  });

  it.each([3, 0, '2', undefined])('refuses format version %j', (version) => {
    expect(codeOf(changed((json) => (json['formatVersion'] = version)))).toBe('unknown-version');
  });

  it('reports a newer version as such, even though its fields differ', () => {
    expect(codeOf({ formatVersion: 3, somethingElse: true })).toBe('unknown-version');
  });

  it.each([
    ['another catalog', (json: SnapshotJson) => (json['catalogFingerprint'] = '00000000')],
    ['spots in another order', (json: SnapshotJson) => json.spots.ids.reverse()],
    ['a missing spot', (json: SnapshotJson) => json.spots.ids.pop()],
  ])('refuses %s', (_, change) => {
    expect(codeOf(changed(change))).toBe('catalog-mismatch');
  });

  it('refuses a snapshot for another grid', () => {
    expect(codeOf(changed((json) => (json.grid.spec['cols'] = 4)))).toBe('grid-mismatch');
  });

  it.each([
    ['not an object', () => [1, 2]],
    ['null', () => null],
    ['a bad fetchedAt', () => changed((json) => (json['fetchedAt'] = 'yesterday'))],
    ['no source', () => changed((json) => Reflect.deleteProperty(json, 'source'))],
    [
      'an incomplete source',
      () => changed((json) => Reflect.deleteProperty(json.source, 'licenseUrl')),
    ],
    ['no hours', () => changed((json) => (json.times = []))],
    ['hours out of order', () => changed((json) => json.times.reverse())],
    ['fractional hours', () => changed((json) => (json.times[0]! += 0.5))],
    ['no spots', () => changed((json) => Reflect.deleteProperty(json, 'spots'))],
    ['no grid spec', () => changed((json) => Reflect.deleteProperty(json.grid, 'spec'))],
    [
      'a missing spot series',
      () => changed((json) => Reflect.deleteProperty(json.spots.series, 'isDay')),
    ],
    [
      'a series that is a bare list',
      () => changed((json) => (json.spots.series['seaLevel'] = [1, 2, 3, 4] as never)),
    ],
    ['a short spot series', () => changed((json) => json.spots.series['seaLevel']?.deltas.pop())],
    ['a short grid field', () => changed((json) => json.grid.fields['windSpeed']?.deltas.pop())],
    [
      'text in a series',
      () => changed((json) => json.grid.fields['swellPeriod']?.deltas.splice(0, 1, 'x')),
    ],
    [
      'a fraction in a series',
      () => changed((json) => json.grid.fields['swellPeriod']?.deltas.splice(0, 1, 1.5)),
    ],
    [
      'no decimals',
      () => changed((json) => Reflect.deleteProperty(json.grid.fields['waveHeight']!, 'decimals')),
    ],
    ['too many decimals', () => changed((json) => (json.spots.series['isDay']!.decimals = 7))],
  ])('refuses a snapshot with %s as malformed', (_, json) => {
    expect(codeOf(json())).toBe('malformed');
  });
});
