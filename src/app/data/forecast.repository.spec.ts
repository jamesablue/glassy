import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  type TestRequest,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import gridMarine from '../../testing/fixtures/raw/open-meteo-grid-marine.json';
import gridWind from '../../testing/fixtures/raw/open-meteo-grid-wind.json';
import spotMarine from '../../testing/fixtures/raw/open-meteo-spot-marine.json';
import spotWeather from '../../testing/fixtures/raw/open-meteo-spot-weather.json';
import { testForecastBundle } from '../../testing/forecast-bundle';
import { DEFAULT_GLASSY_CONFIG } from '../core/glassy-config';
import { provideGlassyConfig } from '../core/glassy-config.token';
import { OAHU_SPOTS } from '../domain/spots';
import { ForecastCache, type CachedForecast } from './cache/forecast-cache';
import { ForecastUnavailableError, RateLimitedError } from './forecast-errors';
import { ForecastRepository, type ForecastResult, type LoadOptions } from './forecast.repository';
import { forecastRequestUrls, type ForecastRequestId } from './open-meteo/open-meteo.urls';

const NOW = Date.UTC(2026, 9, 18, 20, 0);
const URLS = forecastRequestUrls(DEFAULT_GLASSY_CONFIG, OAHU_SPOTS);
const RECORDED: Readonly<Record<ForecastRequestId, object>> = {
  gridMarine,
  gridWind,
  spotMarine,
  spotWeather,
};
const REQUEST_IDS: readonly ForecastRequestId[] = [
  'gridMarine',
  'gridWind',
  'spotMarine',
  'spotWeather',
];

describe('ForecastRepository', () => {
  const cached: CachedForecast = { bundle: testForecastBundle(), fetchedAt: NOW - 10 * 60_000 };
  const cache = {
    getFresh: vi.fn<() => Promise<CachedForecast | undefined>>(),
    getStale: vi.fn<() => Promise<CachedForecast | undefined>>(),
    put: vi.fn<(forecast: CachedForecast) => Promise<void>>(),
  };
  let repository: ForecastRepository;
  let http: HttpTestingController;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    cache.getFresh.mockReset().mockResolvedValue(undefined);
    cache.getStale.mockReset().mockResolvedValue(undefined);
    cache.put.mockReset().mockResolvedValue(undefined);
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideGlassyConfig(),
        { provide: ForecastCache, useValue: cache },
      ],
    });
    repository = TestBed.inject(ForecastRepository);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    vi.useRealTimers();
  });

  interface Outcome {
    readonly result?: ForecastResult;
    readonly error?: unknown;
  }

  /** Starts a load and lets the cache lookup settle, so the requests (if any) are out. */
  async function startLoad(options?: LoadOptions): Promise<{ outcome: Promise<Outcome> }> {
    const outcome = firstValueFrom(repository.load(options)).then(
      (result): Outcome => ({ result }),
      (error: unknown): Outcome => ({ error }),
    );
    await vi.advanceTimersByTimeAsync(0);
    return { outcome };
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

  function answer(request: TestRequest, id: ForecastRequestId): void {
    request.flush(RECORDED[id]);
  }

  function fail(request: TestRequest, status: number, body: object | null = null): void {
    request.flush(body, { status, statusText: 'Error' });
  }

  it('uses a fresh cached forecast without asking the network', async () => {
    cache.getFresh.mockResolvedValue(cached);
    const { outcome } = await startLoad();

    expect((await outcome).result).toEqual({ ...cached, source: 'cache' });
    http.expectNone(() => true);
  });

  it('fetches all four datasets in parallel, adapts and caches them', async () => {
    const { outcome } = await startLoad();
    const requests = pendingRequests();
    REQUEST_IDS.forEach((id) => answer(requests[id], id));

    const { result } = await outcome;
    expect(result?.source).toBe('network');
    expect(result?.fetchedAt).toBe(NOW);
    expect(result?.bundle.times).toHaveLength(48);
    expect(result?.bundle.spots.spotCount).toBe(OAHU_SPOTS.length);
    expect(cache.put).toHaveBeenCalledWith({ bundle: result?.bundle, fetchedAt: NOW });
  });

  it('skips the fresh cache when forced', async () => {
    cache.getFresh.mockResolvedValue(cached);
    const { outcome } = await startLoad({ force: true });
    const requests = pendingRequests();
    REQUEST_IDS.forEach((id) => answer(requests[id], id));

    expect((await outcome).result?.source).toBe('network');
    expect(cache.getFresh).not.toHaveBeenCalled();
  });

  it('retries a request that hit a server error and then succeeds', async () => {
    const { outcome } = await startLoad();
    const requests = pendingRequests();
    fail(requests.gridMarine, 503);
    answer(requests.gridWind, 'gridWind');
    answer(requests.spotMarine, 'spotMarine');
    answer(requests.spotWeather, 'spotWeather');

    await vi.advanceTimersByTimeAsync(1000);
    answer(http.expectOne(URLS.gridMarine), 'gridMarine');

    expect((await outcome).result?.source).toBe('network');
  });

  it('gives up after the retries and reports the forecast as unavailable', async () => {
    const { outcome } = await startLoad();
    const requests = pendingRequests();
    requests.spotWeather.error(new ProgressEvent('error'));
    await vi.advanceTimersByTimeAsync(1000);
    http.expectOne(URLS.spotWeather).error(new ProgressEvent('error'));
    await vi.advanceTimersByTimeAsync(2000);
    http.expectOne(URLS.spotWeather).error(new ProgressEvent('error'));

    const { error } = await outcome;
    expect(error).toBeInstanceOf(ForecastUnavailableError);
    expect(error).toMatchObject({ reason: 'The forecast service could not be reached' });
    expect(cache.put).not.toHaveBeenCalled();
  });

  it('turns HTTP 429 into a RateLimitedError without retrying', async () => {
    const { outcome } = await startLoad();
    const requests = pendingRequests();
    fail(requests.gridWind, 429, { error: true, reason: 'Minutely API request limit exceeded.' });
    await vi.advanceTimersByTimeAsync(10_000);
    http.expectNone(URLS.gridWind);

    const { error } = await outcome;
    expect(error).toBeInstanceOf(RateLimitedError);
    expect(error).toMatchObject({ reason: 'Minutely API request limit exceeded.' });
  });

  it('does not retry other client errors', async () => {
    const { outcome } = await startLoad();
    fail(pendingRequests().spotMarine, 400, { error: true, reason: 'Invalid variable' });
    await vi.advanceTimersByTimeAsync(10_000);

    expect((await outcome).error).toEqual(new ForecastUnavailableError('Invalid variable'));
  });

  it('reports a response that does not fit the grid as unavailable', async () => {
    const { outcome } = await startLoad();
    const requests = pendingRequests();
    REQUEST_IDS.forEach((id) =>
      id === 'gridWind' ? requests[id].flush(spotWeather) : answer(requests[id], id),
    );

    const { error } = await outcome;
    expect(error).toBeInstanceOf(ForecastUnavailableError);
    expect(error).toMatchObject({
      reason: expect.stringMatching(/grid wind response has 25 locations/),
    });
  });

  describe('when the refresh fails', () => {
    beforeEach(() => cache.getStale.mockResolvedValue(cached));

    it('falls back to a stale cached forecast and says why', async () => {
      const { outcome } = await startLoad();
      fail(pendingRequests().gridMarine, 429, { error: true, reason: 'Daily limit exceeded' });

      const { result } = await outcome;
      expect(result).toEqual({
        ...cached,
        source: 'stale-cache',
        error: new RateLimitedError('Daily limit exceeded'),
      });
      expect(cache.put).not.toHaveBeenCalled();
    });

    it('falls back after a forced refresh too', async () => {
      const { outcome } = await startLoad({ force: true });
      fail(pendingRequests().gridMarine, 404);

      expect((await outcome).result?.source).toBe('stale-cache');
    });
  });
});
