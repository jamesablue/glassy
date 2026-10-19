import { computed, inject, Injectable, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { tap } from 'rxjs';
import { RateLimitedError, toForecastError, type ForecastError } from '../data/forecast-errors';
import {
  ForecastRepository,
  type ForecastResult,
  type LoadOptions,
} from '../data/forecast.repository';
import type { ForecastBundle } from '../domain/models';

/**
 * - `loading`: a load is in flight (the previous forecast, if any, is still available)
 * - `ready`: a fresh forecast, from the network or the cache
 * - `stale`: the refresh failed and an older cached forecast is shown; `error` says why
 * - `error`: no forecast could be loaded; `error` says why
 */
export type ForecastStatus = 'loading' | 'ready' | 'stale' | 'error';

export type ForecastSource = ForecastResult['source'];

/**
 * The forecast everything else is derived from, and where it stands.
 *
 * It wraps `ForecastRepository.load()` in an `rxResource`, which turns the repository's one-shot
 * Observable into signals, cancels a superseded load and keeps the app's pending-task count right.
 * Retries and the stale-cache fallback already happen in the repository, so this store only maps
 * results to a status the UI can switch on.
 *
 * Once a forecast has loaded it stays available while a reload runs and after a reload fails, so
 * the map never goes blank because a refresh did not work out.
 */
@Injectable({ providedIn: 'root' })
export class ForecastStore {
  private readonly repository = inject(ForecastRepository);

  /** A new object for every request, so asking again starts a new load even with equal options. */
  private readonly request = signal<LoadOptions>({});
  /**
   * The latest forecast that loaded. The resource drops its value when a new request starts or
   * fails, so the result is kept here as it arrives (a superseded load never gets this far).
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
    return this.lastResult()?.source === 'stale-cache' ? 'stale' : 'ready';
  });
  readonly bundle = computed<ForecastBundle | undefined>(() => this.lastResult()?.bundle);
  /** When the forecast on show was fetched, Unix milliseconds. */
  readonly fetchedAt = computed<number | undefined>(() => this.lastResult()?.fetchedAt);
  readonly source = computed<ForecastSource | undefined>(() => this.lastResult()?.source);
  /** Why the latest load failed, or why the forecast on show is stale. */
  readonly error = computed<ForecastError | undefined>(() => {
    if (this.forecast.isLoading()) return undefined;
    if (this.forecast.status() === 'error') return toForecastError(this.forecast.error());
    const result = this.lastResult();
    return result?.source === 'stale-cache' ? result.error : undefined;
  });
  /**
   * Open-Meteo's rate limit was hit, so the UI should say "try again later" rather than "check
   * your connection".
   */
  readonly isRateLimited = computed(() => this.error() instanceof RateLimitedError);

  /** Loads the forecast again from the network, skipping the cache, for an explicit refresh. */
  reload(): void {
    this.request.set({ force: true });
  }
}
