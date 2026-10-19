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
import type { ForecastBundle } from '../app/domain/models';

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
  const result: ForecastResult = { bundle, fetchedAt: now, source: 'network' };
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

/**
 * A `ForecastRepository` whose loads wait for the test to answer them, so a test can walk the app
 * through loading, a stale forecast and failures. Layers that may not import `data/` (the features)
 * reach the repository and its errors through here.
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
      load.next({ bundle, fetchedAt, source: 'network' });
      load.complete();
    });
  }

  /** Answers the latest load with an older forecast, because the refresh failed. */
  serveStale(bundle: ForecastBundle, fetchedAt: number): void {
    const error = new ForecastUnavailableError('The forecast service could not be reached');
    this.settle((load) => {
      load.next({ bundle, fetchedAt, source: 'stale-cache', error });
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

  private settle(answer: (load: Subject<ForecastResult>) => void): void {
    const load = this.pending.pop();
    if (!load) throw new Error('No forecast load is waiting');
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
