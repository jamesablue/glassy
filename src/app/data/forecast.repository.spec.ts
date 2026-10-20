import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  type TestRequest,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { IDBFactory } from 'fake-indexeddb';
import { lastValueFrom } from 'rxjs';
import gridMarine from '../../testing/fixtures/raw/open-meteo-grid-marine.json';
import gridWind from '../../testing/fixtures/raw/open-meteo-grid-wind.json';
import spotMarine from '../../testing/fixtures/raw/open-meteo-spot-marine.json';
import spotWeather from '../../testing/fixtures/raw/open-meteo-spot-weather.json';
import { testForecastBundle } from '../../testing/forecast-bundle';
import { DEFAULT_GLASSY_CONFIG, type GlassyConfig } from '../core/glassy-config';
import { provideGlassyConfig } from '../core/glassy-config.token';
import { SPOT_CATALOG } from '../core/spot-catalog.token';
import type { Spot } from '../domain/models';
import { OAHU_SPOTS } from '../domain/spots';
import { ForecastCache, type CachedForecast } from './cache/forecast-cache';
import {
  ForecastTimeoutError,
  ForecastUnavailableError,
  RateLimitedError,
} from './forecast-errors';
import { ForecastRepository, type ForecastResult, type LoadOptions } from './forecast.repository';
import { forecastRequestUrls, type ForecastRequestId } from './open-meteo/open-meteo.urls';

const NOW = Date.UTC(2026, 9, 18, 20, 0);
const TIMEOUT_MS = DEFAULT_GLASSY_CONFIG.forecastRequestTimeoutMs;
const URLS = forecastRequestUrls(DEFAULT_GLASSY_CONFIG, OAHU_SPOTS);
const RECORDED: Readonly<Record<ForecastRequestId, object>> = {
  gridMarine,
  gridWind,
  spotMarine,
  spotWeather,
};
const SPOT_REQUESTS = ['spotMarine', 'spotWeather'] as const;
const GRID_REQUESTS = ['gridMarine', 'gridWind'] as const;

describe('ForecastRepository', () => {
  const cached: CachedForecast = { bundle: testForecastBundle(), fetchedAt: NOW - 10 * 60_000 };
  const cache = {
    getFresh: vi.fn<() => Promise<CachedForecast | undefined>>(),
    getStale: vi.fn<() => Promise<CachedForecast | undefined>>(),
    put: vi.fn<(forecast: CachedForecast) => Promise<void>>(),
  };
  let repository: ForecastRepository;
  let http: HttpTestingController;

  function configure(config: Partial<GlassyConfig> = {}): void {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideGlassyConfig(config),
        { provide: ForecastCache, useValue: cache },
      ],
    });
    repository = TestBed.inject(ForecastRepository);
    http = TestBed.inject(HttpTestingController);
  }

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    cache.getFresh.mockReset().mockResolvedValue(undefined);
    cache.getStale.mockReset().mockResolvedValue(undefined);
    cache.put.mockReset().mockResolvedValue(undefined);
    configure();
  });

  afterEach(() => {
    http.verify();
    vi.useRealTimers();
  });

  /** Everything a load has emitted so far, and how it ended. */
  interface Load {
    readonly results: ForecastResult[];
    error?: unknown;
    done: boolean;
  }

  /** Starts a load and lets the cache lookups settle, so the requests (if any) are out. */
  async function startLoad(options?: LoadOptions): Promise<Load> {
    const load: Load = { results: [], done: false };
    repository.load(options).subscribe({
      next: (result) => load.results.push(result),
      error: (error: unknown) => {
        load.error = error;
        load.done = true;
      },
      complete: () => (load.done = true),
    });
    await vi.advanceTimersByTimeAsync(0);
    return load;
  }

  /** The four requests a network load makes, all of them in flight at once. */
  function pendingRequests(): Record<ForecastRequestId, TestRequest> {
    return {
      gridMarine: http.expectOne(URLS.gridMarine),
      gridWind: http.expectOne(URLS.gridWind),
      spotMarine: http.expectOne(URLS.spotMarine),
      spotWeather: http.expectOne(URLS.spotWeather),
    };
  }

  function answer(
    requests: Record<ForecastRequestId, TestRequest>,
    ids: readonly ForecastRequestId[],
  ): void {
    ids.forEach((id) => requests[id].flush(RECORDED[id]));
  }

  function fail(request: TestRequest, status: number, body: object | null = null): void {
    request.flush(body, { status, statusText: 'Error' });
  }

  it('uses a fresh cached forecast without asking the network', async () => {
    cache.getFresh.mockResolvedValue(cached);
    const load = await startLoad();

    expect(load.results).toEqual([{ ...cached, source: 'cache', gridStatus: 'ready' }]);
    expect(load.done).toBe(true);
    http.expectNone(() => true);
  });

  describe('with nothing cached', () => {
    it('sends all four requests at once', async () => {
      await startLoad();
      const requests = pendingRequests();
      answer(requests, [...SPOT_REQUESTS, ...GRID_REQUESTS]);
    });

    it('emits the spot forecast as soon as its requests are in, before the grid', async () => {
      const load = await startLoad();
      const requests = pendingRequests();
      answer(requests, SPOT_REQUESTS);

      expect(load.results).toHaveLength(1);
      const [spots] = load.results;
      expect(spots).toMatchObject({ source: 'network', fetchedAt: NOW, gridStatus: 'loading' });
      expect(spots?.bundle.times).toHaveLength(48);
      expect(spots?.bundle.spots.spotCount).toBe(OAHU_SPOTS.length);
      expect(spots?.bundle).not.toHaveProperty('grid');
      expect(load.done).toBe(false);
      expect(cache.put).not.toHaveBeenCalled();

      // Let the grid finish, so no request is left open.
      answer(requests, GRID_REQUESTS);
    });

    it('then completes it with the grid, keeping the spot forecast, and caches it', async () => {
      const load = await startLoad();
      const requests = pendingRequests();
      answer(requests, SPOT_REQUESTS);
      await vi.advanceTimersByTimeAsync(20_000); // a slow grid, inside its deadline
      answer(requests, GRID_REQUESTS);

      expect(load.results.map((result) => result.gridStatus)).toEqual(['loading', 'ready']);
      const [spots, complete] = load.results;
      if (complete?.gridStatus !== 'ready') throw new Error('The forecast did not complete');
      expect(complete.source).toBe('network');
      expect(complete.bundle.grid.spec).toEqual(DEFAULT_GLASSY_CONFIG.grid);
      // The spot half is the one already on show, so nothing derived from it changes.
      expect(complete.bundle.spots).toBe(spots?.bundle.spots);
      expect(complete.bundle.times).toBe(spots?.bundle.times);
      expect(cache.put).toHaveBeenCalledExactlyOnceWith({
        bundle: complete.bundle,
        fetchedAt: complete.fetchedAt,
      });
      expect(load.done).toBe(true);
    });

    it('emits only the complete forecast when the grid lands first', async () => {
      const load = await startLoad();
      const requests = pendingRequests();
      answer(requests, GRID_REQUESTS);
      expect(load.results).toEqual([]);
      answer(requests, SPOT_REQUESTS);

      expect(load.results.map((result) => result.gridStatus)).toEqual(['ready']);
      expect(load.done).toBe(true);
    });

    it('keeps the spot forecast when the grid fails, and caches nothing', async () => {
      const load = await startLoad();
      const requests = pendingRequests();
      answer(requests, SPOT_REQUESTS);
      fail(requests.gridMarine, 400, { error: true, reason: 'Invalid variable' });

      expect(load.results.map((result) => result.gridStatus)).toEqual(['loading', 'failed']);
      expect(load.results[1]).toMatchObject({
        source: 'network',
        gridError: new ForecastUnavailableError('Invalid variable'),
      });
      expect(load.results[1]?.bundle).toBe(load.results[0]?.bundle);
      expect(requests.gridWind.cancelled).toBe(true);
      expect(cache.put).not.toHaveBeenCalled();
      expect(load.done).toBe(true);
    });

    it('treats grid responses that do not fit the grid as a failed grid', async () => {
      const load = await startLoad();
      const requests = pendingRequests();
      answer(requests, ['spotMarine', 'spotWeather', 'gridMarine']);
      requests.gridWind.flush(spotWeather);

      expect(load.results.at(-1)).toMatchObject({
        gridStatus: 'failed',
        gridError: { reason: expect.stringMatching(/grid wind response has 25 locations/) },
      });
      expect(load.error).toBeUndefined();
    });

    it('fails when the spot forecast fails, and stops waiting for the grid', async () => {
      const load = await startLoad();
      const requests = pendingRequests();
      answer(requests, GRID_REQUESTS.slice(0, 1));
      fail(requests.spotMarine, 404, { error: true, reason: 'Not found' });

      expect(load.results).toEqual([]);
      expect(load.error).toEqual(new ForecastUnavailableError('Not found'));
      expect(requests.gridWind.cancelled).toBe(true);
      expect(requests.spotWeather.cancelled).toBe(true);
    });

    it('reports spot responses that do not fit the catalog as unavailable', async () => {
      const load = await startLoad();
      const requests = pendingRequests();
      requests.spotMarine.flush(gridMarine);
      answer(requests, ['spotWeather']);

      expect(load.error).toBeInstanceOf(ForecastUnavailableError);
      expect(load.error).toMatchObject({
        reason: expect.stringMatching(/spot marine response has 165 locations/),
      });
      expect(requests.gridMarine.cancelled).toBe(true);
    });
  });

  it('skips the fresh cache when forced', async () => {
    cache.getFresh.mockResolvedValue(cached);
    const load = await startLoad({ force: true });
    answer(pendingRequests(), [...SPOT_REQUESTS, ...GRID_REQUESTS]);

    expect(load.results.at(-1)?.source).toBe('network');
    expect(cache.getFresh).not.toHaveBeenCalled();
  });

  describe('retries', () => {
    it('retries a request that hit a server error and then succeeds', async () => {
      const load = await startLoad();
      const requests = pendingRequests();
      fail(requests.gridMarine, 503);
      answer(requests, ['gridWind', ...SPOT_REQUESTS]);

      await vi.advanceTimersByTimeAsync(1000);
      http.expectOne(URLS.gridMarine).flush(gridMarine);

      expect(load.results.at(-1)?.gridStatus).toBe('ready');
    });

    it('gives up after the retries and reports the forecast as unavailable', async () => {
      const load = await startLoad();
      const requests = pendingRequests();
      requests.spotWeather.error(new ProgressEvent('error'));
      await vi.advanceTimersByTimeAsync(1000);
      http.expectOne(URLS.spotWeather).error(new ProgressEvent('error'));
      await vi.advanceTimersByTimeAsync(2000);
      http.expectOne(URLS.spotWeather).error(new ProgressEvent('error'));

      expect(load.error).toBeInstanceOf(ForecastUnavailableError);
      expect(load.error).toMatchObject({ reason: 'The forecast service could not be reached' });
      expect(cache.put).not.toHaveBeenCalled();
    });

    it('turns HTTP 429 into a RateLimitedError without retrying', async () => {
      const load = await startLoad();
      const requests = pendingRequests();
      fail(requests.spotWeather, 429, {
        error: true,
        reason: 'Minutely API request limit exceeded.',
      });
      await vi.advanceTimersByTimeAsync(10_000);
      http.expectNone(URLS.spotWeather);

      expect(load.error).toBeInstanceOf(RateLimitedError);
      expect(load.error).toMatchObject({ reason: 'Minutely API request limit exceeded.' });
    });

    it('does not retry other client errors', async () => {
      const load = await startLoad();
      fail(pendingRequests().spotMarine, 400, { error: true, reason: 'Invalid variable' });
      await vi.advanceTimersByTimeAsync(10_000);

      expect(load.error).toEqual(new ForecastUnavailableError('Invalid variable'));
    });
  });

  describe('timeouts', () => {
    it('stops waiting for a request at its deadline, with a ForecastTimeoutError', async () => {
      const load = await startLoad();
      const requests = pendingRequests();
      answer(requests, ['spotMarine', ...GRID_REQUESTS]);

      await vi.advanceTimersByTimeAsync(TIMEOUT_MS - 1);
      expect(load.done).toBe(false);
      await vi.advanceTimersByTimeAsync(1);

      expect(load.error).toBeInstanceOf(ForecastTimeoutError);
      expect(load.error).toBeInstanceOf(ForecastUnavailableError);
      expect(load.error).toMatchObject({
        timeoutMs: 25_000,
        reason: 'The forecast service did not answer within 25 s',
      });
      // The request is abandoned, not left running in the background.
      expect(requests.spotWeather.cancelled).toBe(true);
    });

    it('does not send a request that timed out again', async () => {
      const load = await startLoad();
      pendingRequests();

      await vi.advanceTimersByTimeAsync(TIMEOUT_MS + 60_000);
      http.expectNone(() => true);
      expect(load.error).toBeInstanceOf(ForecastTimeoutError);
    });

    it('fits the retries inside the deadline, so the worst case is the deadline', async () => {
      const load = await startLoad();
      const requests = pendingRequests();
      answer(requests, ['spotMarine', ...GRID_REQUESTS]);

      // Server errors after 0 s and 1 s; the third attempt, at 3 s, never answers.
      fail(requests.spotWeather, 503);
      await vi.advanceTimersByTimeAsync(1000);
      fail(http.expectOne(URLS.spotWeather), 503);
      await vi.advanceTimersByTimeAsync(2000);
      const third = http.expectOne(URLS.spotWeather);

      await vi.advanceTimersByTimeAsync(TIMEOUT_MS - 3000 - 1);
      expect(load.done).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      expect(load.error).toBeInstanceOf(ForecastTimeoutError);
      expect(Date.now() - NOW).toBe(TIMEOUT_MS);
      expect(third.cancelled).toBe(true);
    });

    it('keeps the spot forecast when only the grid times out', async () => {
      const load = await startLoad();
      const requests = pendingRequests();
      answer(requests, [...SPOT_REQUESTS, 'gridMarine']);

      await vi.advanceTimersByTimeAsync(TIMEOUT_MS);
      expect(load.results.map((result) => result.gridStatus)).toEqual(['loading', 'failed']);
      expect(load.results[1]).toMatchObject({ gridError: expect.any(ForecastTimeoutError) });
      expect(load.done).toBe(true);
    });

    it('takes its deadline from the config', async () => {
      configure({ forecastRequestTimeoutMs: 5000 });
      const load = await startLoad();
      pendingRequests();

      await vi.advanceTimersByTimeAsync(5000);
      expect(load.error).toMatchObject({ timeoutMs: 5000 });
    });
  });

  describe('with a stale cached forecast', () => {
    beforeEach(() => cache.getStale.mockResolvedValue(cached));

    it('shows it at once and refreshes it in the background', async () => {
      const load = await startLoad();

      expect(load.results).toEqual([
        { ...cached, source: 'stale-cache', refreshing: true, gridStatus: 'ready' },
      ]);
      const requests = pendingRequests();
      answer(requests, [...SPOT_REQUESTS, ...GRID_REQUESTS]);

      expect(load.results).toHaveLength(2);
      const fresh = load.results[1];
      expect(fresh).toMatchObject({ source: 'network', fetchedAt: NOW, gridStatus: 'ready' });
      expect(cache.put).toHaveBeenCalledWith({ bundle: fresh?.bundle, fetchedAt: NOW });
      expect(load.done).toBe(true);
    });

    it('swaps in only a complete forecast, not the spot forecast alone', async () => {
      const load = await startLoad();
      const requests = pendingRequests();
      answer(requests, SPOT_REQUESTS);

      expect(load.results).toHaveLength(1);
      answer(requests, GRID_REQUESTS);
      expect(load.results.map((result) => result.source)).toEqual(['stale-cache', 'network']);
    });

    it('keeps it when the refresh fails, and says why', async () => {
      const load = await startLoad();
      fail(pendingRequests().gridMarine, 429, { error: true, reason: 'Daily limit exceeded' });

      expect(load.results.at(-1)).toEqual({
        ...cached,
        source: 'stale-cache',
        refreshing: false,
        error: new RateLimitedError('Daily limit exceeded'),
        gridStatus: 'ready',
      });
      expect(cache.put).not.toHaveBeenCalled();
      expect(load.done).toBe(true);
    });

    it('keeps it when the refresh times out', async () => {
      const load = await startLoad();
      const requests = pendingRequests();
      answer(requests, ['gridMarine', ...SPOT_REQUESTS]);

      await vi.advanceTimersByTimeAsync(TIMEOUT_MS);
      expect(load.results.at(-1)).toMatchObject({
        source: 'stale-cache',
        refreshing: false,
        error: expect.any(ForecastTimeoutError),
      });
    });

    it('shows it while a forced refresh runs too', async () => {
      const load = await startLoad({ force: true });
      expect(load.results[0]).toMatchObject({ source: 'stale-cache', refreshing: true });
      fail(pendingRequests().gridMarine, 404);

      expect(load.results.at(-1)).toMatchObject({ source: 'stale-cache', refreshing: false });
    });
  });
});

describe('ForecastRepository with the IndexedDB cache', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    vi.stubGlobal('indexedDB', new IDBFactory());
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  function configure(spots: readonly Spot[]): {
    repository: ForecastRepository;
    cache: ForecastCache;
    http: HttpTestingController;
  } {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideGlassyConfig(),
        { provide: SPOT_CATALOG, useValue: spots },
      ],
    });
    return {
      repository: TestBed.inject(ForecastRepository),
      cache: TestBed.inject(ForecastCache),
      http: TestBed.inject(HttpTestingController),
    };
  }

  it('ignores a forecast cached for another spot list and loads a new one', async () => {
    // A visit before a spot was added: its forecast has one series fewer than the catalog now.
    const before = configure(OAHU_SPOTS.slice(1));
    await before.cache.put({ bundle: testForecastBundle(), fetchedAt: NOW - 60_000 });

    const { repository, http } = configure(OAHU_SPOTS);
    const result = lastValueFrom(repository.load());
    await vi.waitFor(() => http.expectOne(URLS.gridMarine).flush(gridMarine));
    http.expectOne(URLS.gridWind).flush(gridWind);
    http.expectOne(URLS.spotMarine).flush(spotMarine);
    http.expectOne(URLS.spotWeather).flush(spotWeather);

    const loaded = await result;
    expect(loaded.source).toBe('network');
    expect(loaded.bundle.spots.spotCount).toBe(OAHU_SPOTS.length);
    http.verify();
  });

  it('shows a stale forecast for this spot list while it refreshes', async () => {
    const { repository, cache, http } = configure(OAHU_SPOTS);
    const stored = { bundle: testForecastBundle(), fetchedAt: NOW - 2 * 3_600_000 };
    await cache.put(stored);

    const results: ForecastResult[] = [];
    const done = new Promise<void>((resolve) =>
      repository.load().subscribe({ next: (r) => results.push(r), complete: resolve }),
    );
    await vi.waitFor(() => expect(results).toHaveLength(1));
    expect(results[0]).toMatchObject({ source: 'stale-cache', refreshing: true });

    http.expectOne(URLS.gridMarine).flush(gridMarine);
    http.expectOne(URLS.gridWind).flush(gridWind);
    http.expectOne(URLS.spotMarine).flush(spotMarine);
    http.expectOne(URLS.spotWeather).flush(spotWeather);
    await done;
    const fresh = results.at(-1);
    expect(fresh?.source).toBe('network');
    expect((await cache.getFresh())?.fetchedAt).toBe(fresh?.fetchedAt);
    http.verify();
  });
});
