import { TestBed } from '@angular/core/testing';
import { IDBFactory, IDBObjectStore } from 'fake-indexeddb';
import { createStore, set } from 'idb-keyval';
import { testForecastBundle } from '../../../testing/forecast-bundle';
import { provideGlassyConfig } from '../../core/glassy-config.token';
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

  function createCache(): ForecastCache {
    TestBed.configureTestingModule({
      providers: [
        provideGlassyConfig({ cacheLifetimeMs: 45 * MINUTE, cacheMaxStaleMs: 12 * HOUR }),
      ],
    });
    return TestBed.inject(ForecastCache);
  }

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

    it.each([
      ['an older version', { version: FORECAST_CACHE_VERSION - 1, fetchedAt: FETCHED_AT, bundle }],
      ['no timestamp', { version: FORECAST_CACHE_VERSION, bundle }],
      ['no bundle', { version: FORECAST_CACHE_VERSION, fetchedAt: FETCHED_AT, bundle: null }],
      ['something else entirely', 'not a record'],
    ])('treats a record with %s as a miss', async (_case, record) => {
      await set('latest', record, createStore('glassy', 'forecast'));
      expect(await cache.getFresh()).toBeUndefined();
      expect(await cache.getStale()).toBeUndefined();
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
