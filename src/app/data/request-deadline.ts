import { throwError, timeout, type MonoTypeOperatorFunction } from 'rxjs';
import { ForecastTimeoutError } from './forecast-errors';

/**
 * Fails with a {@link ForecastTimeoutError} when the source has not emitted within `ms`, and
 * unsubscribes from it, which aborts an HTTP request still in flight.
 *
 * Put after `retryTransient`, the deadline covers every attempt of a request and the waits between
 * them. The retries then fit inside it instead of adding to it, so a request never takes longer
 * than `ms` however it fails. A request that ran out of time is not sent again: an upstream slow
 * enough to time out only gets slower when it is asked twice.
 */
export function withDeadline<T>(ms: number): MonoTypeOperatorFunction<T> {
  return timeout({ first: ms, with: () => throwError(() => new ForecastTimeoutError(ms)) });
}
