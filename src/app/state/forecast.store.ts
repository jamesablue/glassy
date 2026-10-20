import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { tap } from 'rxjs';
import { RateLimitedError, toForecastError, type ForecastError } from '../data/forecast-errors';
import {
  ForecastRepository,
  type ForecastResult,
  type GridStatus,
  type LoadOptions,
} from '../data/forecast.repository';
import type { GridForecast, SpotForecastBundle } from '../domain/models';
import { ConnectivityStore } from './connectivity.store';

export type { GridStatus } from '../data/forecast.repository';

/**
 * - `loading`: a load is in flight. A forecast may be on show meanwhile: the one from before a
 *   reload, or an older cached one that is being refreshed in the background
 *   (`source: 'stale-cache'`)
 * - `ready`: a fresh forecast, from the network or the cache (its grid may still be on its way;
 *   see `gridStatus`)
 * - `stale`: the refresh failed and an older cached forecast is shown; `error` says why
 * - `error`: no forecast could be loaded; `error` says why
 */
export type ForecastStatus = 'loading' | 'ready' | 'stale' | 'error';

export type ForecastSource = ForecastResult['source'];

/**
 * The forecast everything else is derived from, and where it stands.
 *
 * It wraps `ForecastRepository.load()` in an `rxResource`, which turns the repository's results
 * into signals, cancels a superseded load and keeps the app's pending-task count right. Retries,
 * timeouts, the stale cache and the order results arrive in are the repository's business, so this
 * store only maps the latest result to what the UI switches on.
 *
 * A load can bring the forecast in two parts: the spot forecast first, and the map grid when its
 * slower requests land. So the spot forecast (`bundle`, read by the ranking, the details and the
 * timeline) and the grid (`grid` and `gridStatus`, read by the map) are separate signals, and the
 * grid's arrival leaves `bundle`, and everything derived from it, untouched.
 *
 * Once a forecast has loaded it stays available while a reload runs and after a reload fails, so
 * the map never goes blank because a refresh did not work out. When the browser comes back online
 * after a load failed (or left a stale forecast, or no map grid, on show), it loads again by itself.
 */
@Injectable({ providedIn: 'root' })
export class ForecastStore {
  private readonly repository = inject(ForecastRepository);

  /** A new object for every request, so asking again starts a new load even with equal options. */
  private readonly request = signal<LoadOptions>({});
  /**
   * The latest result. The resource drops its value when a new request starts or fails, so each
   * result is kept here as it arrives (a superseded load never gets this far).
   */
  private readonly lastResult = signal<ForecastResult | undefined>(undefined);
  private readonly forecast = rxResource({
    params: () => this.request(),
    stream: ({ params }) =>
      this.repository.load(params).pipe(tap((result) => this.lastResult.set(result))),
  });

  readonly status = computed<ForecastStatus>(() => {
    if (this.forecast.isLoading()) return 'loading';
    if (this.forecast.status() === 'error') return 'error';
    const result = this.lastResult();
    if (result?.source !== 'stale-cache') return 'ready';
    // A stale forecast on show while it is refreshed is a load still in flight.
    return result.refreshing ? 'loading' : 'stale';
  });
  /** The spot forecast on show: the times, daylight and every spot's series. */
  readonly bundle = computed<SpotForecastBundle | undefined>(() => this.lastResult()?.bundle, {
    equal: sameSpotForecast,
  });
  /** The map grid of the forecast on show, or `undefined` while it loads or when it failed. */
  readonly grid = computed<GridForecast | undefined>(() => {
    const result = this.lastResult();
    return result?.gridStatus === 'ready' ? result.bundle.grid : undefined;
  });
  /** Where the grid of the forecast on show stands, or `undefined` before anything is on show. */
  readonly gridStatus = computed<GridStatus | undefined>(() => this.lastResult()?.gridStatus);
  /** When the forecast on show was fetched, Unix milliseconds. */
  readonly fetchedAt = computed<number | undefined>(() => this.lastResult()?.fetchedAt);
  readonly source = computed<ForecastSource | undefined>(() => this.lastResult()?.source);
  /** Why the latest load failed, or why the forecast on show is stale. */
  readonly error = computed<ForecastError | undefined>(() => {
    if (this.forecast.isLoading()) return undefined;
    if (this.forecast.status() === 'error') return toForecastError(this.forecast.error());
    const result = this.lastResult();
    return result?.source === 'stale-cache' && !result.refreshing ? result.error : undefined;
  });
  /**
   * Open-Meteo's rate limit was hit, so the UI should say "try again later" rather than "check
   * your connection".
   */
  readonly isRateLimited = computed(() => this.error() instanceof RateLimitedError);

  constructor() {
    const connectivity = inject(ConnectivityStore);
    effect(() => {
      if (!connectivity.online()) return;
      const status = untracked(this.status);
      const gridFailed = untracked(this.gridStatus) === 'failed';
      if (status === 'error' || status === 'stale' || gridFailed) untracked(() => this.reload());
    });
  }

  /** Loads the forecast again from the network, skipping the fresh cache, for an explicit refresh. */
  reload(): void {
    this.request.set({ force: true });
  }
}

/**
 * Whether two spot forecasts hold the same data. Completing a forecast with its grid keeps the spot
 * forecast's arrays (see `withGrid` in the data layer), so the grid's arrival is not a new spot
 * forecast: the scores, the ranking and the timeline are not worked out again, and nothing moves.
 */
function sameSpotForecast(
  a: SpotForecastBundle | undefined,
  b: SpotForecastBundle | undefined,
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.times === b.times && a.isDay === b.isDay && a.spots === b.spots;
}
