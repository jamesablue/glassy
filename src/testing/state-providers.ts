import type { Provider } from '@angular/core';
import { of, Subject, type Observable } from 'rxjs';
import { CLOCK, type Clock } from '../app/core/clock';
import { ForecastUnavailableError, RateLimitedError } from '../app/data/forecast-errors';
import {
  ForecastRepository,
  type ForecastResult,
  type LoadOptions,
} from '../app/data/forecast.repository';
import { BathymetryClient } from '../app/data/noaa/bathymetry.client';
import type { ForecastBundle, SpotForecastBundle } from '../app/domain/models';

/** A clock that stays where a test puts it. */
export class FakeClock implements Clock {
  constructor(public time: number) {}

  now(): number {
    return this.time;
  }
}

/**
 * Providers for testing the stores against a known forecast: the repository answers every load
 * with `bundle` straight from the network, and the clock stands still at `now` (Unix ms).
 */
export function provideTestForecast(bundle: ForecastBundle, now: number): Provider[] {
  const result: ForecastResult = { bundle, fetchedAt: now, source: 'network', gridStatus: 'ready' };
  return [
    { provide: ForecastRepository, useValue: { load: () => of(result) } },
    { provide: CLOCK, useValue: new FakeClock(now) },
  ];
}

/**
 * A `BathymetryClient` that answers every point with `elevationAt`, for components that show depths
 * but may not import `data/` themselves.
 */
export function provideFakeBathymetry(
  elevationAt: (lat: number, lon: number) => Observable<number>,
): Provider {
  return { provide: BathymetryClient, useValue: { elevationAt } };
}

/** The spot half of a forecast, without its grid, as a progressive load first delivers it. */
export function spotHalf({ times, isDay, spots }: ForecastBundle): SpotForecastBundle {
  return { times, isDay, spots };
}

/**
 * A `ForecastRepository` whose loads wait for the test to answer them, so a test can walk the app
 * through loading, a stale forecast, a forecast that arrives in parts, and failures. Layers that may
 * not import `data/` (the features) reach the repository and its errors through here.
 */
export class ScriptedForecastRepository {
  /** The options of every load asked for, oldest first. */
  readonly requests: LoadOptions[] = [];
  private readonly pending: Subject<ForecastResult>[] = [];

  load(options: LoadOptions = {}): Observable<ForecastResult> {
    this.requests.push(options);
    const load = new Subject<ForecastResult>();
    this.pending.push(load);
    return load.asObservable();
  }

  /** Answers the latest load with a forecast fresh from the network. */
  succeed(bundle: ForecastBundle, fetchedAt: number): void {
    this.settle((load) => {
      load.next({ bundle, fetchedAt, source: 'network', gridStatus: 'ready' });
      load.complete();
    });
  }

  /** Answers the latest load with an older forecast, because the refresh failed. */
  serveStale(bundle: ForecastBundle, fetchedAt: number): void {
    const error = new ForecastUnavailableError('The forecast service could not be reached');
    this.settle((load) => {
      load.next({
        bundle,
        fetchedAt,
        source: 'stale-cache',
        refreshing: false,
        error,
        gridStatus: 'ready',
      });
      load.complete();
    });
  }

  /**
   * Shows an older cached forecast on the latest load while it refreshes in the background. The
   * load stays open: answer it again with {@link succeed} or {@link serveStale}.
   */
  serveStaleWhileRefreshing(bundle: ForecastBundle, fetchedAt: number): void {
    this.latest().next({
      bundle,
      fetchedAt,
      source: 'stale-cache',
      refreshing: true,
      gridStatus: 'ready',
    });
  }

  /**
   * Answers the latest load with the spot half of `bundle`, its grid still on the way. The load
   * stays open: answer it again with {@link succeed} or {@link failGrid}.
   */
  serveSpots(bundle: ForecastBundle, fetchedAt: number): void {
    this.latest().next({
      bundle: spotHalf(bundle),
      fetchedAt,
      source: 'network',
      gridStatus: 'loading',
    });
  }

  /** Finishes the latest load with the spot half of `bundle`: its grid could not be loaded. */
  failGrid(bundle: ForecastBundle, fetchedAt: number): void {
    const gridError = new ForecastUnavailableError('The forecast service answered HTTP 503');
    this.settle((load) => {
      load.next({
        bundle: spotHalf(bundle),
        fetchedAt,
        source: 'network',
        gridStatus: 'failed',
        gridError,
      });
      load.complete();
    });
  }

  /** Fails the latest load: Open-Meteo's rate limit (HTTP 429) or any other failure. */
  fail(kind: 'rate-limited' | 'unavailable'): void {
    const error =
      kind === 'rate-limited'
        ? new RateLimitedError('Too many requests')
        : new ForecastUnavailableError('The forecast service could not be reached');
    this.settle((load) => load.error(error));
  }

  private latest(): Subject<ForecastResult> {
    const load = this.pending.at(-1);
    if (!load) throw new Error('No forecast load is waiting');
    return load;
  }

  private settle(answer: (load: Subject<ForecastResult>) => void): void {
    const load = this.latest();
    this.pending.pop();
    answer(load);
  }
}

/** Providers for a {@link ScriptedForecastRepository} and a clock fixed at `now` (Unix ms). */
export function provideScriptedForecast(
  repository: ScriptedForecastRepository,
  now: number,
): Provider[] {
  return [
    { provide: ForecastRepository, useValue: repository },
    { provide: CLOCK, useValue: new FakeClock(now) },
  ];
}
