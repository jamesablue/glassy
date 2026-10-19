import { inject, Injectable } from '@angular/core';
import {
  catchError,
  defer,
  forkJoin,
  map,
  of,
  switchMap,
  tap,
  throwError,
  type Observable,
} from 'rxjs';
import { GLASSY_CONFIG } from '../core/glassy-config.token';
import { SPOT_CATALOG } from '../core/spot-catalog.token';
import { ForecastCache, type CachedForecast } from './cache/forecast-cache';
import { toForecastError, type ForecastError } from './forecast-errors';
import { toForecastBundle } from './open-meteo/open-meteo.adapter';
import { OpenMeteoClient } from './open-meteo/open-meteo.client';
import { retryTransient, type RetryPolicy } from './retry-transient';

/**
 * Two quick retries (after 1 s and 2 s) ride out a dropped connection or a brief outage without
 * keeping the user waiting long before the stale fallback or an error.
 */
export const FORECAST_RETRY: RetryPolicy = { retries: 2, initialDelayMs: 1000 };

/**
 * A loaded forecast and where it came from. A `stale-cache` result means the refresh failed and an
 * older forecast is shown instead, so it carries the error for the UI to explain
 * ("Couldn't refresh the forecast (reason). Showing data from 9 AM.").
 */
export type ForecastResult =
  | (CachedForecast & { readonly source: 'network' | 'cache' })
  | (CachedForecast & { readonly source: 'stale-cache'; readonly error: ForecastError });

export interface LoadOptions {
  /** Skip the fresh cache and go to the network, for an explicit refresh. */
  readonly force?: boolean;
}

/**
 * Loads the forecast the state layer works from: cache first, then the network, then a stale
 * cached copy as a last resort. A forecast only changes when the models re-run, so a fresh cached
 * copy saves four requests against a rate-limited API; and data a few hours old is far more useful
 * at the beach than an error message.
 */
@Injectable({ providedIn: 'root' })
export class ForecastRepository {
  private readonly client = inject(OpenMeteoClient);
  private readonly cache = inject(ForecastCache);
  private readonly grid = inject(GLASSY_CONFIG).grid;
  private readonly spotCount = inject(SPOT_CATALOG).length;

  /**
   * Emits one {@link ForecastResult} and completes.
   *
   * @throws RateLimitedError (as an error notification) when Open-Meteo answers 429 and there is
   *   no cached forecast within the maximum stale age
   * @throws ForecastUnavailableError for any other failure without such a cached forecast
   */
  load(options: LoadOptions = {}): Observable<ForecastResult> {
    const fresh = options.force ? of(undefined) : defer(() => this.cache.getFresh());
    return fresh.pipe(
      switchMap((cached) =>
        cached ? of<ForecastResult>({ ...cached, source: 'cache' }) : this.fetch(),
      ),
    );
  }

  private fetch(): Observable<ForecastResult> {
    return forkJoin({
      gridMarine: this.client.gridMarine().pipe(retryTransient(FORECAST_RETRY)),
      gridWind: this.client.gridWind().pipe(retryTransient(FORECAST_RETRY)),
      spotMarine: this.client.spotMarine().pipe(retryTransient(FORECAST_RETRY)),
      spotWeather: this.client.spotWeather().pipe(retryTransient(FORECAST_RETRY)),
    }).pipe(
      map((responses): CachedForecast => ({
        bundle: toForecastBundle(responses, this.grid, this.spotCount),
        fetchedAt: Date.now(),
      })),
      // Saving is best-effort and never fails, so it does not hold up the result.
      tap((forecast) => void this.cache.put(forecast)),
      map((forecast): ForecastResult => ({ ...forecast, source: 'network' })),
      catchError((error: unknown) => this.fallBackToStale(toForecastError(error))),
    );
  }

  private fallBackToStale(error: ForecastError): Observable<ForecastResult> {
    return defer(() => this.cache.getStale()).pipe(
      switchMap((stale) =>
        stale
          ? of<ForecastResult>({ ...stale, source: 'stale-cache', error })
          : throwError(() => error),
      ),
    );
  }
}
