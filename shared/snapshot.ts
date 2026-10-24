import { catalogFingerprint } from './catalog-fingerprint';
import { sameGrid, type GridSpec } from './grid';
import { MAX_SERIES_DECIMALS, type EncodedSeries } from './series-codec';
import type { Spot } from './spots';
import { GRID_VARIABLES, SPOT_VARIABLES, type GridVariable, type SpotVariable } from './variables';

/**
 * The version of the snapshot format below. Changing the format means a new version, and an app
 * that accepts both versions ships before a backend that writes the new one (ADR-0010).
 *
 * Version 1 is provisional until the ingest publishes in production (#38), and may still change in
 * place until then.
 */
export const SNAPSHOT_FORMAT_VERSION = 1;

/** Where a snapshot's data comes from, for the attribution its license asks for. */
export interface SnapshotSource {
  readonly name: string;
  readonly url: string;
  readonly license: string;
  readonly licenseUrl: string;
  /** The snapshot trims and reshapes the data, which CC BY 4.0 asks us to say. */
  readonly modified: boolean;
}

/** Open-Meteo, the source of every value in a snapshot. */
export const OPEN_METEO_SOURCE: SnapshotSource = {
  name: 'Open-Meteo',
  url: 'https://open-meteo.com',
  license: 'CC BY 4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
  modified: true,
};

/**
 * One forecast for the whole island, written by the backend ingest as `forecast.json`. Every
 * series is on the same hourly time axis, `times`, and encoded as an {@link EncodedSeries}: one
 * run of hours per spot or grid cell. Decode one with `decodeSeries`.
 */
export interface ForecastSnapshot {
  readonly formatVersion: typeof SNAPSHOT_FORMAT_VERSION;
  /** When the ingest fetched the data, ISO 8601. */
  readonly fetchedAt: string;
  readonly source: SnapshotSource;
  /** {@link catalogFingerprint} of the catalog the spot series were fetched for. */
  readonly catalogFingerprint: string;
  /** Start of each hour, Unix seconds, ascending. */
  readonly times: readonly number[];
  readonly spots: {
    /** Spot ids in catalog order: the order of the values within each hour. */
    readonly ids: readonly string[];
    /** One run per spot, in `ids` order. `isDay` is 1 or 0. */
    readonly series: Readonly<Record<SpotVariable, EncodedSeries>>;
  };
  readonly grid: {
    readonly spec: GridSpec;
    /** One run per cell, `rows * cols` runs in field order (see `gridCellCenters`). */
    readonly fields: Readonly<Record<GridVariable, EncodedSeries>>;
  };
}

/**
 * Why a snapshot was refused:
 *
 * - `unknown-version`: a format this code does not read
 * - `catalog-mismatch`: made for another spot catalog, or the same spots in another order
 * - `grid-mismatch`: made for another forecast grid
 * - `malformed`: missing fields, wrong types, or series of the wrong length or not in whole numbers
 */
export type SnapshotErrorCode =
  'unknown-version' | 'catalog-mismatch' | 'grid-mismatch' | 'malformed';

export class SnapshotError extends Error {
  override readonly name = 'SnapshotError';

  constructor(
    readonly code: SnapshotErrorCode,
    message: string,
  ) {
    super(message);
  }
}

/** What the reader of a snapshot expects it to have been made for. */
export interface SnapshotExpectations {
  readonly spots: readonly Spot[];
  readonly grid: GridSpec;
}

/**
 * Checks that `json` is a snapshot this code can read, made for `expected`, and returns it typed.
 * The version is checked first, so a newer format is reported as such rather than as malformed.
 *
 * @throws SnapshotError when it is not
 */
export function parseSnapshot(json: unknown, expected: SnapshotExpectations): ForecastSnapshot {
  if (!isRecord(json)) throw malformed('The snapshot is not a JSON object');
  if (json['formatVersion'] !== SNAPSHOT_FORMAT_VERSION) {
    throw new SnapshotError(
      'unknown-version',
      `The snapshot has format version ${String(json['formatVersion'])}, not ${SNAPSHOT_FORMAT_VERSION}`,
    );
  }

  const { fetchedAt, source, times, spots, grid } = json;
  if (typeof fetchedAt !== 'string' || Number.isNaN(Date.parse(fetchedAt))) {
    throw malformed('fetchedAt is not a date');
  }
  if (!isSource(source)) throw malformed('source is missing or incomplete');
  if (!isTimeAxis(times)) throw malformed('times is not an ascending list of whole seconds');
  if (!isRecord(spots) || !isStringList(spots['ids']) || !isRecord(spots['series'])) {
    throw malformed('spots is missing or incomplete');
  }
  if (!isRecord(grid) || !isGridSpec(grid['spec']) || !isRecord(grid['fields'])) {
    throw malformed('grid is missing or incomplete');
  }

  const ids = spots['ids'];
  const expectedIds = expected.spots.map((spot) => spot.id);
  if (
    json['catalogFingerprint'] !== catalogFingerprint(expected.spots) ||
    ids.length !== expectedIds.length ||
    ids.some((id, index) => id !== expectedIds[index])
  ) {
    throw new SnapshotError('catalog-mismatch', 'The snapshot was made for another spot catalog');
  }
  if (!sameGrid(grid['spec'], expected.grid)) {
    throw new SnapshotError('grid-mismatch', 'The snapshot was made for another forecast grid');
  }

  checkSeries(spots['series'], SPOT_VARIABLES, times.length * ids.length, 'spot');
  const cellCount = expected.grid.rows * expected.grid.cols;
  checkSeries(grid['fields'], GRID_VARIABLES, times.length * cellCount, 'grid');

  return json as unknown as ForecastSnapshot;
}

function checkSeries(
  series: Readonly<Record<string, unknown>>,
  variables: readonly string[],
  length: number,
  label: string,
): void {
  for (const variable of variables) {
    const encoded = series[variable];
    if (!isRecord(encoded)) throw malformed(`The ${label} series "${variable}" is missing`);
    const { decimals, deltas } = encoded;
    if (
      !Number.isInteger(decimals) ||
      (decimals as number) < 0 ||
      (decimals as number) > MAX_SERIES_DECIMALS
    ) {
      throw malformed(`The ${label} series "${variable}" has no valid number of decimals`);
    }
    if (!Array.isArray(deltas) || deltas.length !== length) {
      throw malformed(`The ${label} series "${variable}" does not have ${length} values`);
    }
    if (!deltas.every((delta) => delta === null || Number.isSafeInteger(delta))) {
      throw malformed(`The ${label} series "${variable}" holds something other than whole numbers`);
    }
  }
}

function malformed(message: string): SnapshotError {
  return new SnapshotError('malformed', message);
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringList(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isTimeAxis(value: unknown): value is readonly number[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(
      (time, index) =>
        Number.isInteger(time) && (index === 0 || (time as number) > (value[index - 1] as number)),
    )
  );
}

function isSource(value: unknown): value is SnapshotSource {
  return (
    isRecord(value) &&
    ['name', 'url', 'license', 'licenseUrl'].every((key) => typeof value[key] === 'string') &&
    typeof value['modified'] === 'boolean'
  );
}

function isGridSpec(value: unknown): value is GridSpec {
  return (
    isRecord(value) &&
    ['lat0', 'lon0', 'step', 'rows', 'cols'].every((key) => Number.isFinite(value[key]))
  );
}
