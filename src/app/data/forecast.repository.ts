import { inject, Injectable } from '@angular/core';
import {
  catchError,
  combineLatest,
  concat,
  defer,
  forkJoin,
  map,
  of,
  startWith,
  switchMap,
  throwError,
  type Observable,
} from 'rxjs';
import { GLASSY_CONFIG } from '../core/glassy-config.token';
import { SPOT_CATALOG } from '../core/spot-catalog.token';
import type { ForecastBundle, SpotForecastBundle } from '../domain/models';
import { ForecastCache, type CachedForecast } from './cache/forecast-cache';
import { toForecastError, type ForecastError } from './forecast-errors';
import { toForecastBundle, toSpotForecastBundle, withGrid } from './open-meteo/open-meteo.adapter';
import { OpenMeteoClient } from './open-meteo/open-meteo.client';
import type { OpenMeteoGridResponses, OpenMeteoSpotResponses } from './open-meteo/open-meteo.types';
import { withDeadline } from './request-deadline';
import { retryTransient, type RetryPolicy } from './retry-transient';

/**
 * Two quick retries (after 1 s and 2 s) ride out a dropped connection or a brief outage without
 * keeping the user waiting long before the stale fallback or an error. They run inside each
 * request's deadline (`forecastRequestTimeoutMs`), never after it.
 */
export const FORECAST_RETRY: RetryPolicy = { retries: 2, initialDelayMs: 1000 };

/**
 * Where the map grid of a result stands:
 *
 * - `ready`: the result is a complete forecast, its grid included
 * - `loading`: the spot forecast is in and the grid requests are still out; another result follows
 * - `failed`: the spot forecast is in, but the grid could not be loaded
 */
export type GridStatus = 'ready' | 'loading' | 'failed';

/** A complete forecast: the spot forecast and the map grid, from one fetch. */
interface CompleteForecast extends CachedForecast {
  readonly gridStatus: 'ready';
}

/** A fresh forecast, from the network or a cached copy within its lifetime. */
export interface FreshForecastResult extends CompleteForecast {
  readonly source: 'network' | 'cache';
}

/**
 * An older cached forecast (within the maximum stale age). While `refreshing` it is on show while
 * a background refresh runs, and another result follows. Otherwise the refresh failed and it stays,
 * with the `error` for the UI to explain ("Couldn't refresh the forecast. Showing data from 9 AM.").
 */
export type StaleForecastResult = CompleteForecast & { readonly source: 'stale-cache' } & (
    { readonly refreshing: true } | { readonly refreshing: false; readonly error: ForecastError }
  );

/**
 * A network load's spot forecast without its grid: the grid requests are still out (`loading`, and
 * another result follows) or failed (`failed`, with `gridError`). Only a first visit, with nothing
 * cached to show meanwhile, sees one.
 */
export type SpotForecastResult = {
  readonly source: 'network';
  readonly bundle: SpotForecastBundle;
  /** When the spot forecast arrived, Unix milliseconds. */
  readonly fetchedAt: number;
} & (
  | { readonly gridStatus: 'loading' }
  | { readonly gridStatus: 'failed'; readonly gridError: ForecastError }
);

/** What a load emits: a forecast, how complete it is, and where it came from. */
export type ForecastResult = FreshForecastResult | StaleForecastResult | SpotForecastResult;

export interface LoadOptions {
  /** Skip the fresh cache and go to the network, for an explicit refresh. */
  readonly force?: boolean;
}

/** The grid requests of a progressive load: still out, answered, or failed. */
type GridOutcome =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly responses: OpenMeteoGridResponses }
  | { readonly status: 'failed'; readonly error: ForecastError };

/** The spot requests' answers and the spot forecast made from them. */
interface SpotPart {
  readonly responses: OpenMeteoSpotResponses;
  readonly bundle: SpotForecastBundle;
  readonly fetchedAt: number;
}

/**
 * Loads the forecast the state layer works from, showing something as early as it can:
 *
 * 1. A fresh cached forecast is used as it is. A forecast only changes when the models re-run, so
 *    it saves four requests against a rate-limited API.
 * 2. Otherwise a stale cached forecast is shown at once and refreshed in the background
 *    (stale-while-revalidate). A returning visitor never waits on the network.
 * 3. With nothing cached, the spot forecast is shown as soon as its two requests are in and the map
 *    grid follows, because the grid request (165 points) can take far longer than the rest.
 *
 * Every request gives up after `forecastRequestTimeoutMs`, retries included, and the requests run
 * in parallel, so no load waits on the network for longer than that (25 s by default).
 */
@Injectable({ providedIn: 'root' })
export class ForecastRepository {
  private readonly client = inject(OpenMeteoClient);
  private readonly cache = inject(ForecastCache);
  private readonly config = inject(GLASSY_CONFIG);
  private readonly spotCount = inject(SPOT_CATALOG).length;

  /**
   * Emits one or more {@link ForecastResult}s and completes. A result with
   * `source: 'stale-cache', refreshing: true` or `gridStatus: 'loading'` is followed by another.
   *
   * @throws RateLimitedError (as an error notification) when Open-Meteo answers 429 and there is
   *   no cached forecast within the maximum stale age
   * @throws ForecastUnavailableError for any other failure without such a cached forecast,
   *   including a `ForecastTimeoutError` for a request that ran out of time
   */
  load(options: LoadOptions = {}): Observable<ForecastResult> {
    const fresh = options.force ? of(undefined) : defer(() => this.cache.getFresh());
    return fresh.pipe(
      switchMap((cached) =>
        cached
          ? of<ForecastResult>({ ...cached, source: 'cache', gridStatus: 'ready' })
          : this.loadFromNetwork(),
      ),
    );
  }

  private loadFromNetwork(): Observable<ForecastResult> {
    return defer(() => this.cache.getStale()).pipe(
      switchMap((stale) => (stale ? this.revalidate(stale) : this.loadProgressively())),
    );
  }

  /**
   * Shows the stale forecast at once, then swaps in the fresh one once all four requests are in. A
   * stale forecast is only ever replaced by a complete one, so the ranking and the map always show
   * the same fetch: a refresh that fails in any part (the grid included) keeps the stale forecast,
   * with the reason, and the next reload tries again.
   */
  private revalidate(stale: CachedForecast): Observable<ForecastResult> {
    return concat(
      of<ForecastResult>({
        ...stale,
        source: 'stale-cache',
        refreshing: true,
        gridStatus: 'ready',
      }),
      forkJoin([this.spotResponses(), this.gridResponses()]).pipe(
        map(([spots, grid]) =>
          this.fetched(toForecastBundle({ ...spots, ...grid }, this.config.grid, this.spotCount)),
        ),
        catchError((error: unknown) =>
          of<ForecastResult>({
            ...stale,
            source: 'stale-cache',
            refreshing: false,
            error: toForecastError(error),
            gridStatus: 'ready',
          }),
        ),
      ),
    );
  }

  /**
   * Loads with nothing to show yet. The spot and grid requests go out together, and the spot
   * forecast is emitted as soon as its own two requests are in: the ranking, the spot details and
   * the timeline need nothing from the grid, so they should not wait for it. The complete forecast
   * follows when the grid lands (straight away if it landed first). A grid that fails leaves the
   * spot forecast on show; without the spot forecast there is nothing to show, so its failure
   * fails the load and cancels the grid requests.
   */
  private loadProgressively(): Observable<ForecastResult> {
    const spots = this.spotResponses().pipe(
      map((responses): SpotPart => ({
        responses,
        bundle: toSpotForecastBundle(responses, this.spotCount),
        fetchedAt: Date.now(),
      })),
    );
    const grid = this.gridResponses().pipe(
      map((responses): GridOutcome => ({ status: 'ready', responses })),
      catchError((error: unknown) =>
        of<GridOutcome>({ status: 'failed', error: toForecastError(error) }),
      ),
      // Superseded unseen when the grid lands before the spots.
      startWith<GridOutcome>({ status: 'loading' }),
    );
    return combineLatest([spots, grid]).pipe(
      map(([spotPart, outcome]) => this.progress(spotPart, outcome)),
      catchError((error: unknown) => throwError(() => toForecastError(error))),
    );
  }

  private progress(spots: SpotPart, grid: GridOutcome): ForecastResult {
    const partial = {
      source: 'network',
      bundle: spots.bundle,
      fetchedAt: spots.fetchedAt,
    } as const;
    switch (grid.status) {
      case 'loading':
        return { ...partial, gridStatus: 'loading' };
      case 'failed':
        return { ...partial, gridStatus: 'failed', gridError: grid.error };
      case 'ready':
        try {
          const responses = { ...spots.responses, ...grid.responses };
          return this.fetched(withGrid(spots.bundle, responses, this.config.grid, this.spotCount));
        } catch (error) {
          // Grid responses that do not fit are as good as none; the spot forecast still stands.
          return { ...partial, gridStatus: 'failed', gridError: toForecastError(error) };
        }
    }
  }

  /**
   * A complete forecast fresh from the network, which is also cached. Only complete forecasts are
   * cached: whatever the cache returns can be drawn in full, and a spot forecast alone would hide
   * the map layers for the whole cache lifetime.
   */
  private fetched(bundle: ForecastBundle): ForecastResult {
    const forecast: CachedForecast = { bundle, fetchedAt: Date.now() };
    // Saving is best-effort and never fails, so it does not hold up the result.
    void this.cache.put(forecast);
    return { ...forecast, source: 'network', gridStatus: 'ready' };
  }

  private spotResponses(): Observable<OpenMeteoSpotResponses> {
    return forkJoin({
      spotMarine: this.guarded(this.client.spotMarine()),
      spotWeather: this.guarded(this.client.spotWeather()),
    });
  }

  private gridResponses(): Observable<OpenMeteoGridResponses> {
    return forkJoin({
      gridMarine: this.guarded(this.client.gridMarine()),
      gridWind: this.guarded(this.client.gridWind()),
    });
  }

  /**
   * A request with its retries and its deadline. The deadline comes after the retries, so it
   * covers all of them: the worst case for a request is the deadline itself, not three of them.
   */
  private guarded<T>(request: Observable<T>): Observable<T> {
    return request.pipe(
      retryTransient(FORECAST_RETRY),
      withDeadline(this.config.forecastRequestTimeoutMs),
    );
  }
}
