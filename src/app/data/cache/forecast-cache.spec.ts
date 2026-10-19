import { TestBed } from '@angular/core/testing';
import { IDBFactory, IDBObjectStore } from 'fake-indexeddb';
import { createStore, set } from 'idb-keyval';
import { testForecastBundle } from '../../../testing/forecast-bundle';
import { DEFAULT_GLASSY_CONFIG, type GlassyConfig } from '../../core/glassy-config';
import { provideGlassyConfig } from '../../core/glassy-config.token';
import { SPOT_CATALOG } from '../../core/spot-catalog.token';
import type { Spot } from '../../domain/models';
import { OAHU_SPOTS } from '../../domain/spots';
import { FORECAST_CACHE_VERSION, ForecastCache } from './forecast-cache';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const FETCHED_AT = Date.UTC(2026, 9, 18, 18, 0);

/**
 * Under jsdom the database clones values into Node's own realm, so compare with a structured clone
 * of the input (as a browser would return) and check types by tag rather than `instanceof`.
 */
const typeTag = (value: unknown): string => Object.prototype.toString.call(value);

describe('ForecastCache', () => {
  const bundle = testForecastBundle();

  /** A cache for an app with `spots` and the config's defaults, with `overrides` on top. */
  function createCache(
    spots: readonly Spot[] = OAHU_SPOTS,
    overrides: Partial<GlassyConfig> = {},
  ): ForecastCache {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideGlassyConfig({
          cacheLifetimeMs: 45 * MINUTE,
          cacheMaxStaleMs: 12 * HOUR,
          ...overrides,
        }),
        { provide: SPOT_CATALOG, useValue: spots },
      ],
    });
    return TestBed.inject(ForecastCache);
  }

  /** The record a cache writes, with `changes` applied: for a record left by other code. */
  const record = (changes: object): object => ({
    version: FORECAST_CACHE_VERSION,
    fetchedAt: FETCHED_AT,
    bundle,
    catalog: OAHU_SPOTS.map((spot) => spot.id),
    grid: DEFAULT_GLASSY_CONFIG.grid,
    ...changes,
  });

  /** Lets the cache read the clock as `msAfterFetch` after the forecast was fetched. */
  function setClock(msAfterFetch: number): void {
    vi.setSystemTime(FETCHED_AT + msAfterFetch);
  }

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    setClock(0);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('with IndexedDB', () => {
    let cache: ForecastCache;

    beforeEach(() => {
      vi.stubGlobal('indexedDB', new IDBFactory());
      cache = createCache();
    });

    it('is empty at first', async () => {
      expect(await cache.getFresh()).toBeUndefined();
      expect(await cache.getStale()).toBeUndefined();
    });

    it('gives back the stored bundle with its typed arrays and exact values', async () => {
      await cache.put({ bundle, fetchedAt: FETCHED_AT });
      const cached = await cache.getFresh();

      expect(cached?.fetchedAt).toBe(FETCHED_AT);
      expect(cached?.bundle).toEqual(structuredClone(bundle));
      expect(cached?.bundle).not.toBe(bundle);
      expect(typeTag(cached?.bundle.grid.fields.waveHeight)).toBe('[object Float32Array]');
      expect(typeTag(cached?.bundle.grid.vectors.wind.u)).toBe('[object Float32Array]');
      expect(typeTag(cached?.bundle.spots.series.isDay)).toBe('[object Float32Array]');
      expect(cached?.bundle.spots.series.windGust[0]).toBeNaN();
      // Not rounded on the way through: still the 32-bit float nearest 1.3.
      expect(cached?.bundle.grid.fields.waveHeight[1]).toBe(Math.fround(1.3));
    });

    it('is fresh for the cache lifetime', async () => {
      await cache.put({ bundle, fetchedAt: FETCHED_AT });
      setClock(45 * MINUTE - 1);
      expect(await cache.getFresh()).toBeDefined();
      setClock(45 * MINUTE);
      expect(await cache.getFresh()).toBeUndefined();
    });

    it('stays usable as a stale fallback for the maximum stale age', async () => {
      await cache.put({ bundle, fetchedAt: FETCHED_AT });
      setClock(3 * HOUR);
      expect(await cache.getFresh()).toBeUndefined();
      expect((await cache.getStale())?.fetchedAt).toBe(FETCHED_AT);
      setClock(12 * HOUR);
      expect(await cache.getStale()).toBeUndefined();
    });

    it('ignores a forecast from the future, for example after the clock moved back', async () => {
      await cache.put({ bundle, fetchedAt: FETCHED_AT + MINUTE });
      expect(await cache.getFresh()).toBeUndefined();
      expect(await cache.getStale()).toBeUndefined();
    });

    it('replaces the previous forecast', async () => {
      await cache.put({ bundle, fetchedAt: FETCHED_AT - HOUR });
      const newer = testForecastBundle(2);
      await cache.put({ bundle: newer, fetchedAt: FETCHED_AT });
      expect(await cache.getFresh()).toEqual({
        bundle: structuredClone(newer),
        fetchedAt: FETCHED_AT,
      });
    });

    it('reads a record in the shape it writes', async () => {
      await set('latest', record({}), createStore('glassy', 'forecast'));
      expect((await cache.getFresh())?.fetchedAt).toBe(FETCHED_AT);
    });

    it.each([
      ['an older version', record({ version: FORECAST_CACHE_VERSION - 1 })],
      ['no timestamp', record({ fetchedAt: undefined })],
      ['no bundle', record({ bundle: null })],
      ['no spot catalog, as version 1 wrote', record({ catalog: undefined })],
      ['no grid', record({ grid: null })],
      ['something else entirely', 'not a record'],
    ])('treats a record with %s as a miss', async (_case, stored) => {
      await set('latest', stored, createStore('glassy', 'forecast'));
      expect(await cache.getFresh()).toBeUndefined();
      expect(await cache.getStale()).toBeUndefined();
    });

    describe('when the app has changed since the forecast was cached', () => {
      const [first, second, ...rest] = OAHU_SPOTS as readonly [Spot, Spot, ...Spot[]];
      const extra: Spot = { ...first, id: 'new-spot', name: 'New spot' };

      it.each([
        ['a spot was added', [...OAHU_SPOTS, extra]],
        ['a spot was removed', [second, ...rest]],
        ['two spots swapped places', [second, first, ...rest]],
        ['a spot was renamed', [{ ...first, id: 'renamed' }, second, ...rest]],
      ])('treats it as a miss when %s', async (_case, spots) => {
        await cache.put({ bundle, fetchedAt: FETCHED_AT });

        const changed = createCache(spots);
        expect(await changed.getFresh()).toBeUndefined();
        expect(await changed.getStale()).toBeUndefined();
      });

      it('treats it as a miss when the grid moved', async () => {
        await cache.put({ bundle, fetchedAt: FETCHED_AT });
        const grid = { ...DEFAULT_GLASSY_CONFIG.grid, cols: DEFAULT_GLASSY_CONFIG.grid.cols + 1 };

        const changed = createCache(OAHU_SPOTS, { grid });
        expect(await changed.getFresh()).toBeUndefined();
        expect(await changed.getStale()).toBeUndefined();
      });

      it('still reads it when only a spot’s details changed', async () => {
        await cache.put({ bundle, fetchedAt: FETCHED_AT });

        const changed = createCache([{ ...first, name: 'Renamed' }, second, ...rest]);
        expect((await changed.getFresh())?.fetchedAt).toBe(FETCHED_AT);
      });
    });

    it('carries on when the forecast cannot be stored', async () => {
      await cache.put({ bundle, fetchedAt: FETCHED_AT - HOUR });
      vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(() => {
        throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
      });

      await expect(cache.put({ bundle, fetchedAt: FETCHED_AT })).resolves.toBeUndefined();
      expect((await cache.getStale())?.fetchedAt).toBe(FETCHED_AT - HOUR);
    });
  });

  it('works as an empty cache when the database cannot be opened', async () => {
    vi.stubGlobal('indexedDB', {
      open: () => {
        throw new DOMException('Access denied in private browsing.', 'SecurityError');
      },
    });
    const cache = createCache();

    await expect(cache.put({ bundle, fetchedAt: FETCHED_AT })).resolves.toBeUndefined();
    expect(await cache.getFresh()).toBeUndefined();
    expect(await cache.getStale()).toBeUndefined();
  });

  it('works as an empty cache without IndexedDB at all', async () => {
    vi.stubGlobal('indexedDB', undefined);
    const cache = createCache();

    await expect(cache.put({ bundle, fetchedAt: FETCHED_AT })).resolves.toBeUndefined();
    expect(await cache.getFresh()).toBeUndefined();
  });
});
