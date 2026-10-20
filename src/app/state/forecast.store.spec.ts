import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject, type Observable } from 'rxjs';
import { testForecastBundle } from '../../testing/forecast-bundle';
import { spotHalf } from '../../testing/state-providers';
import {
  ForecastError,
  ForecastTimeoutError,
  ForecastUnavailableError,
  RateLimitedError,
} from '../data/forecast-errors';
import {
  ForecastRepository,
  type ForecastResult,
  type FreshForecastResult,
  type LoadOptions,
  type SpotForecastResult,
  type StaleForecastResult,
} from '../data/forecast.repository';
import type { ForecastBundle } from '../domain/models';
import { ForecastStore } from './forecast.store';

describe('ForecastStore', () => {
  const FETCHED_AT = Date.UTC(2026, 9, 18, 20);
  const bundle = testForecastBundle();
  const network: FreshForecastResult = {
    bundle,
    fetchedAt: FETCHED_AT,
    source: 'network',
    gridStatus: 'ready',
  };
  /** An older cached forecast whose refresh failed with `error`. */
  const stale = (error: ForecastError): StaleForecastResult => ({
    ...network,
    source: 'stale-cache',
    refreshing: false,
    error,
  });
  /** An older cached forecast, on show while a refresh runs. */
  const refreshing: StaleForecastResult = { ...network, source: 'stale-cache', refreshing: true };
  /** The spot half of `forecast` with its grid still on the way. */
  const spotsOf = (forecast: ForecastBundle, fetchedAt = FETCHED_AT): SpotForecastResult => ({
    bundle: spotHalf(forecast),
    fetchedAt,
    source: 'network',
    gridStatus: 'loading',
  });

  const repository = { load: vi.fn<(options?: LoadOptions) => Observable<ForecastResult>>() };
  /** Each load gets its own subject, so a test answers loads one at a time. */
  let loads: Subject<ForecastResult>[];
  let store: ForecastStore;

  beforeEach(() => {
    loads = [];
    repository.load.mockReset().mockImplementation(() => {
      const load = new Subject<ForecastResult>();
      loads.push(load);
      return load.asObservable();
    });
    TestBed.configureTestingModule({
      providers: [{ provide: ForecastRepository, useValue: repository }],
    });
    store = TestBed.inject(ForecastStore);
    TestBed.tick();
  });

  function latestLoad(): Subject<ForecastResult> {
    const load = loads.at(-1);
    if (!load) throw new Error('No load has started');
    return load;
  }

  /** Answers the latest load and waits for the store to take it in. */
  async function answer(outcome: ForecastResult | Error): Promise<void> {
    const load = latestLoad();
    if (outcome instanceof Error) {
      load.error(outcome);
    } else {
      load.next(outcome);
      load.complete();
    }
    await TestBed.inject(ApplicationRef).whenStable();
  }

  /** Emits a result on the latest load, which stays open for more. */
  async function emit(result: ForecastResult): Promise<void> {
    latestLoad().next(result);
    await TestBed.inject(ApplicationRef).whenStable();
  }

  it('loads once, from the cache if it can, as soon as it is created', () => {
    expect(repository.load).toHaveBeenCalledTimes(1);
    expect(repository.load).toHaveBeenCalledWith({});
  });

  it('is loading until the repository answers', () => {
    expect(store.status()).toBe('loading');
    expect(store.bundle()).toBeUndefined();
    expect(store.fetchedAt()).toBeUndefined();
    expect(store.source()).toBeUndefined();
    expect(store.error()).toBeUndefined();
    expect(store.isRateLimited()).toBe(false);
  });

  it.each(['network', 'cache'] as const)('is ready with a forecast from the %s', async (source) => {
    await answer({ ...network, source });

    expect(store.status()).toBe('ready');
    expect(store.bundle()).toBe(bundle);
    expect(store.fetchedAt()).toBe(FETCHED_AT);
    expect(store.source()).toBe(source);
    expect(store.error()).toBeUndefined();
  });

  it('shows a stale forecast and keeps the reason the refresh failed', async () => {
    const error = new ForecastUnavailableError('The forecast service could not be reached');
    await answer(stale(error));

    expect(store.status()).toBe('stale');
    expect(store.bundle()).toBe(bundle);
    expect(store.source()).toBe('stale-cache');
    expect(store.error()).toBe(error);
    expect(store.isRateLimited()).toBe(false);
  });

  it('flags a stale forecast caused by the rate limit', async () => {
    const error = new RateLimitedError('Daily API request limit exceeded');
    await answer(stale(error));

    expect(store.status()).toBe('stale');
    expect(store.isRateLimited()).toBe(true);
  });

  it('reports an error when no forecast could be loaded', async () => {
    const error = new ForecastUnavailableError('The forecast service answered HTTP 502');
    await answer(error);

    expect(store.status()).toBe('error');
    expect(store.bundle()).toBeUndefined();
    expect(store.error()).toBe(error);
    expect(store.isRateLimited()).toBe(false);
  });

  it('flags the rate limit when it is why nothing loaded', async () => {
    await answer(new RateLimitedError('Too many forecast requests'));

    expect(store.status()).toBe('error');
    expect(store.error()).toBeInstanceOf(RateLimitedError);
    expect(store.isRateLimited()).toBe(true);
  });

  it('turns an unexpected failure into a typed error', async () => {
    await answer(new TypeError('bundle.times is undefined'));

    expect(store.error()).toBeInstanceOf(ForecastUnavailableError);
    expect(store.error()?.reason).toBe('bundle.times is undefined');
  });

  it('has the map grid of a complete forecast', async () => {
    await answer(network);

    expect(store.grid()).toBe(bundle.grid);
    expect(store.gridStatus()).toBe('ready');
  });

  describe('a forecast that arrives in two parts', () => {
    it('is ready with the spot forecast while the grid is on its way', async () => {
      await emit(spotsOf(bundle));

      expect(store.status()).toBe('ready');
      expect(store.bundle()?.times).toBe(bundle.times);
      expect(store.grid()).toBeUndefined();
      expect(store.gridStatus()).toBe('loading');
      expect(store.source()).toBe('network');
      expect(store.error()).toBeUndefined();
    });

    it('adds the grid without touching the spot forecast', async () => {
      const spots = spotsOf(bundle);
      await emit(spots);
      const shown = store.bundle();
      await answer({ ...network, bundle: { ...spots.bundle, grid: bundle.grid } });

      expect(store.status()).toBe('ready');
      expect(store.grid()).toBe(bundle.grid);
      expect(store.gridStatus()).toBe('ready');
      // The same spot forecast, so nothing derived from it is worked out again.
      expect(store.bundle()).toBe(shown);
    });

    it('takes a forecast moved to other hours as a new spot forecast', async () => {
      await emit(spotsOf(bundle));
      const shorter = testForecastBundle(2);
      await answer({ ...network, bundle: shorter });

      expect(store.bundle()).toBe(shorter);
      expect(store.grid()).toBe(shorter.grid);
    });

    it('keeps the spot forecast when the grid fails, without calling it an error', async () => {
      await emit(spotsOf(bundle));
      const gridError = new ForecastTimeoutError(25_000);
      await answer({ ...spotsOf(bundle), gridStatus: 'failed', gridError });

      expect(store.status()).toBe('ready');
      expect(store.bundle()?.spots).toBe(bundle.spots);
      expect(store.grid()).toBeUndefined();
      expect(store.gridStatus()).toBe('failed');
      expect(store.error()).toBeUndefined();
    });
  });

  describe('a stale forecast while it refreshes', () => {
    it('is on show at once, with the load still under way', async () => {
      await emit(refreshing);

      expect(store.status()).toBe('loading');
      expect(store.bundle()).toBe(bundle);
      expect(store.grid()).toBe(bundle.grid);
      expect(store.source()).toBe('stale-cache');
      expect(store.fetchedAt()).toBe(FETCHED_AT);
      expect(store.error()).toBeUndefined();
    });

    it('gives way to the fresh forecast', async () => {
      await emit(refreshing);
      const fresh = testForecastBundle(4);
      await answer({ ...network, bundle: fresh, fetchedAt: FETCHED_AT + 3_600_000 });

      expect(store.status()).toBe('ready');
      expect(store.bundle()).toBe(fresh);
      expect(store.source()).toBe('network');
      expect(store.fetchedAt()).toBe(FETCHED_AT + 3_600_000);
    });

    it('stays when the refresh fails, with the reason', async () => {
      await emit(refreshing);
      const error = new ForecastTimeoutError(25_000);
      await answer(stale(error));

      expect(store.status()).toBe('stale');
      expect(store.bundle()).toBe(bundle);
      expect(store.error()).toBe(error);
    });
  });

  describe('reload', () => {
    it('goes to the network, skipping the cache', async () => {
      await answer(network);
      store.reload();
      TestBed.tick();

      expect(repository.load).toHaveBeenCalledTimes(2);
      expect(repository.load).toHaveBeenLastCalledWith({ force: true });
    });

    it('keeps showing the current forecast while it loads', async () => {
      await answer(network);
      store.reload();
      TestBed.tick();

      expect(store.status()).toBe('loading');
      expect(store.bundle()).toBe(bundle);
      expect(store.error()).toBeUndefined();
    });

    it('replaces the forecast when the new one arrives', async () => {
      await answer(stale(new RateLimitedError('Slow down')));
      const fresh = testForecastBundle(4);
      store.reload();
      TestBed.tick();
      await answer({ ...network, bundle: fresh, fetchedAt: FETCHED_AT + 60_000 });

      expect(store.status()).toBe('ready');
      expect(store.bundle()).toBe(fresh);
      expect(store.fetchedAt()).toBe(FETCHED_AT + 60_000);
      expect(store.error()).toBeUndefined();
      expect(store.isRateLimited()).toBe(false);
    });

    it('keeps the current forecast when the reload fails', async () => {
      await answer(network);
      store.reload();
      TestBed.tick();
      await answer(new ForecastUnavailableError('offline'));

      expect(store.status()).toBe('error');
      expect(store.error()?.reason).toBe('offline');
      expect(store.bundle()).toBe(bundle);
    });

    it('recovers from an error', async () => {
      await answer(new ForecastUnavailableError('offline'));
      store.reload();
      TestBed.tick();
      expect(store.status()).toBe('loading');

      await answer(network);
      expect(store.status()).toBe('ready');
      expect(store.bundle()).toBe(bundle);
    });

    it('starts a new load each time it is asked', async () => {
      await answer(network);
      store.reload();
      TestBed.tick();
      await answer(network);
      store.reload();
      TestBed.tick();

      expect(repository.load).toHaveBeenCalledTimes(3);
    });
  });

  describe('when the connection comes back', () => {
    let onLine: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      onLine = vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(true);
    });

    afterEach(() => onLine.mockRestore());

    /** The browser loses its connection, or gets it back. */
    function connection(online: boolean): void {
      onLine.mockReturnValue(online);
      window.dispatchEvent(new Event(online ? 'online' : 'offline'));
      TestBed.tick();
    }

    it('loads again after a failed load', async () => {
      connection(false);
      await answer(new ForecastUnavailableError('The forecast service could not be reached'));
      expect(repository.load).toHaveBeenCalledTimes(1);

      connection(true);
      expect(repository.load).toHaveBeenCalledTimes(2);
      expect(repository.load).toHaveBeenLastCalledWith({ force: true });
      expect(store.status()).toBe('loading');
    });

    it('loads again while a stale forecast is on show', async () => {
      const error = new ForecastUnavailableError('The forecast service could not be reached');
      await answer(stale(error));
      connection(false);
      connection(true);

      expect(repository.load).toHaveBeenCalledTimes(2);
    });

    it('loads again when the map grid could not be loaded', async () => {
      await answer({
        ...spotsOf(bundle),
        gridStatus: 'failed',
        gridError: new ForecastUnavailableError('The forecast service could not be reached'),
      });
      connection(false);
      connection(true);

      expect(repository.load).toHaveBeenCalledTimes(2);
    });

    it('leaves a stale forecast that is refreshing alone', async () => {
      await emit(refreshing);
      connection(false);
      connection(true);

      expect(repository.load).toHaveBeenCalledTimes(1);
    });

    it('leaves a good forecast alone', async () => {
      await answer(network);
      connection(false);
      connection(true);

      expect(repository.load).toHaveBeenCalledTimes(1);
    });

    it('waits for a load already under way', () => {
      connection(false);
      connection(true);

      expect(repository.load).toHaveBeenCalledTimes(1);
      expect(store.status()).toBe('loading');
    });
  });
});
