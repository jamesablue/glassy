import { HttpErrorResponse } from '@angular/common/http';

/** Why the forecast could not be loaded. */
export abstract class ForecastError extends Error {
  /**
   * @param reason a short cause the UI can show, for example Open-Meteo's own explanation
   */
  protected constructor(
    readonly reason: string,
    options?: ErrorOptions,
  ) {
    super(reason, options);
  }
}

/**
 * Open-Meteo answered HTTP 429: a minutely, hourly or daily limit of the free tier was reached.
 * Kept apart from other failures because retrying straight away only makes it worse, and the UI
 * should say "try again later" rather than "check your connection".
 */
export class RateLimitedError extends ForecastError {
  override readonly name = 'RateLimitedError';

  constructor(reason: string, options?: ErrorOptions) {
    super(reason, options);
  }
}

/** Any other failure: offline, server errors that outlasted the retries, or a malformed response. */
export class ForecastUnavailableError extends ForecastError {
  override readonly name = 'ForecastUnavailableError';

  constructor(reason: string, options?: ErrorOptions) {
    super(reason, options);
  }
}

/**
 * Maps anything a forecast load can throw to a {@link ForecastError}, keeping the original as
 * `cause`. HTTP errors carry Open-Meteo's `reason` when the body has one.
 */
export function toForecastError(error: unknown): ForecastError {
  if (error instanceof ForecastError) return error;
  if (error instanceof HttpErrorResponse) {
    const options = { cause: error };
    if (error.status === 429) {
      return new RateLimitedError(reasonOf(error) ?? 'Too many forecast requests', options);
    }
    const fallback =
      error.status === 0
        ? 'The forecast service could not be reached'
        : `The forecast service answered HTTP ${error.status}`;
    return new ForecastUnavailableError(reasonOf(error) ?? fallback, options);
  }
  const reason = error instanceof Error ? error.message : 'The forecast could not be read';
  return new ForecastUnavailableError(reason, { cause: error });
}

/** Open-Meteo explains errors in a JSON body: `{ "error": true, "reason": "…" }`. */
function reasonOf(error: HttpErrorResponse): string | undefined {
  const body: unknown = error.error;
  if (typeof body === 'object' && body !== null && 'reason' in body) {
    return typeof body.reason === 'string' && body.reason !== '' ? body.reason : undefined;
  }
  return undefined;
}
