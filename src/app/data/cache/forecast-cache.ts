import { inject, Injectable } from '@angular/core';
import { createStore, get, set, type UseStore } from 'idb-keyval';
import { GLASSY_CONFIG } from '../../core/glassy-config.token';
import { SPOT_CATALOG } from '../../core/spot-catalog.token';
import type { ForecastBundle, GridSpec } from '../../domain/models';

/** A forecast and when it was fetched. */
export interface CachedForecast {
  readonly bundle: ForecastBundle;
  /** Unix milliseconds. */
  readonly fetchedAt: number;
}

/**
 * Version of the stored record. Bump it whenever `ForecastBundle` or the record changes shape:
 * records written by older code are then ignored and overwritten by the next successful fetch.
 * Version 2 added the catalog and grid the forecast was fetched for.
 */
export const FORECAST_CACHE_VERSION = 2;

const DB_NAME = 'glassy';
const STORE_NAME = 'forecast';
const RECORD_KEY = 'latest';

interface CacheRecord extends CachedForecast {
  readonly version: number;
  /** The ids of the spots the bundle's per-spot series follow, in order. */
  readonly catalog: readonly string[];
  /** The grid the bundle's fields were fetched on. */
  readonly grid: GridSpec;
}

/**
 * Keeps the last forecast in IndexedDB so a reload within the cache lifetime makes no requests
 * (Open-Meteo's free tier is rate limited) and a failed refresh can still show recent data.
 *
 * The bundle is stored as it is: IndexedDB's structured clone keeps `Float32Array`s intact, so a
 * five-day grid forecast needs no JSON encoding, rounding or re-packing on the way in or out.
 * Storage is best-effort. Every failure (no IndexedDB, private browsing, quota exceeded, a corrupt
 * record) reads as a cache miss and never reaches the user.
 *
 * A bundle only fits the spots and grid it was fetched for: its per-spot series follow the
 * catalog's order and its fields the grid's cells. Each record therefore keeps the spot ids in
 * order and the grid next to the bundle. A record made for another catalog (spots added, removed
 * or reordered) or another grid is a miss, fresh or stale, so a returning visitor gets a new
 * forecast instead of one that no longer lines up with the spots.
 */
@Injectable({ providedIn: 'root' })
export class ForecastCache {
  private readonly config = inject(GLASSY_CONFIG);
  private readonly catalog = inject(SPOT_CATALOG).map((spot) => spot.id);
  // Opens the database lazily, on first use.
  private readonly store: UseStore = createStore(DB_NAME, STORE_NAME);

  /** The cached forecast if it is recent enough to use without asking the network. */
  getFresh(): Promise<CachedForecast | undefined> {
    return this.read(this.config.cacheLifetimeMs);
  }

  /** The cached forecast if it is recent enough to show, with a notice, when a refresh fails. */
  getStale(): Promise<CachedForecast | undefined> {
    return this.read(this.config.cacheMaxStaleMs);
  }

  /** Replaces the cached forecast. Resolves even when the forecast could not be stored. */
  async put(forecast: CachedForecast): Promise<void> {
    const record: CacheRecord = {
      ...forecast,
      version: FORECAST_CACHE_VERSION,
      catalog: this.catalog,
      grid: this.config.grid,
    };
    try {
      await set(RECORD_KEY, record, this.store);
    } catch {
      // The app works without a cache; it just fetches again next time.
    }
  }

  private async read(maxAgeMs: number): Promise<CachedForecast | undefined> {
    try {
      const record: unknown = await get(RECORD_KEY, this.store);
      if (!isCurrentRecord(record) || !this.fitsConfig(record)) return undefined;
      const age = Date.now() - record.fetchedAt;
      // A negative age means the clock moved back; don't trust the record.
      if (age < 0 || age >= maxAgeMs) return undefined;
      return { bundle: record.bundle, fetchedAt: record.fetchedAt };
    } catch {
      return undefined;
    }
  }

  /** Whether the record was fetched for the spots and grid the app runs with. */
  private fitsConfig(record: CacheRecord): boolean {
    return sameIds(record.catalog, this.catalog) && sameGrid(record.grid, this.config.grid);
  }
}

function isCurrentRecord(value: unknown): value is CacheRecord {
  return (
    typeof value === 'object' &&
    value !== null &&
    'version' in value &&
    value.version === FORECAST_CACHE_VERSION &&
    'fetchedAt' in value &&
    typeof value.fetchedAt === 'number' &&
    'bundle' in value &&
    typeof value.bundle === 'object' &&
    value.bundle !== null &&
    'catalog' in value &&
    Array.isArray(value.catalog) &&
    'grid' in value &&
    typeof value.grid === 'object' &&
    value.grid !== null
  );
}

function sameIds(stored: readonly unknown[], current: readonly string[]): boolean {
  return stored.length === current.length && stored.every((id, index) => id === current[index]);
}

function sameGrid(stored: GridSpec, current: GridSpec): boolean {
  return (
    stored.lat0 === current.lat0 &&
    stored.lon0 === current.lon0 &&
    stored.step === current.step &&
    stored.rows === current.rows &&
    stored.cols === current.cols
  );
}
