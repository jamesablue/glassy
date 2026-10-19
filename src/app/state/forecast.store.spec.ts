import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject, type Observable } from 'rxjs';
import { testForecastBundle } from '../../testing/forecast-bundle';
import { ForecastUnavailableError, RateLimitedError } from '../data/forecast-errors';
import {
  ForecastRepository,
  type ForecastResult,
  type LoadOptions,
} from '../data/forecast.repository';
import { ForecastStore } from './forecast.store';

describe('ForecastStore', () => {
  const FETCHED_AT = Date.UTC(2026, 9, 18, 20);
  const bundle = testForecastBundle();
  const network: ForecastResult = { bundle, fetchedAt: FETCHED_AT, source: 'network' };

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

  /** Answers the latest load and waits for the store to take it in. */
  async function answer(outcome: ForecastResult | Error): Promise<void> {
    const load = loads.at(-1);
    if (!load) throw new Error('No load has started');
    if (outcome instanceof Error) {
      load.error(outcome);
    } else {
      load.next(outcome);
      load.complete();
    }
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
    await answer({ ...network, source: 'stale-cache', error });

    expect(store.status()).toBe('stale');
    expect(store.bundle()).toBe(bundle);
    expect(store.source()).toBe('stale-cache');
    expect(store.error()).toBe(error);
    expect(store.isRateLimited()).toBe(false);
  });

  it('flags a stale forecast caused by the rate limit', async () => {
    const error = new RateLimitedError('Daily API request limit exceeded');
    await answer({ ...network, source: 'stale-cache', error });

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
      await answer({ ...network, source: 'stale-cache', error: new RateLimitedError('Slow down') });
      const fresh = testForecastBundle(4);
      store.reload();
      TestBed.tick();
      await answer({ bundle: fresh, fetchedAt: FETCHED_AT + 60_000, source: 'network' });

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
});
