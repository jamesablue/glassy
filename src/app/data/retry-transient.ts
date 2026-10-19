import { HttpErrorResponse } from '@angular/common/http';
import { retry, throwError, timer, type MonoTypeOperatorFunction } from 'rxjs';

export interface RetryPolicy {
  /** Retries after the first attempt. */
  readonly retries: number;
  /** Wait before the first retry, ms. Each later retry waits twice as long as the one before. */
  readonly initialDelayMs: number;
}

/**
 * Network failures (status 0) and 5xx responses: problems that often clear up within seconds.
 * A 4xx is the request's fault and stays wrong however often it is sent, and retrying a 429 only
 * eats further into the rate limit.
 */
export function isTransient(error: unknown): boolean {
  return error instanceof HttpErrorResponse && (error.status === 0 || error.status >= 500);
}

/** Retries transient HTTP failures with exponential backoff and rethrows everything else at once. */
export function retryTransient<T>(policy: RetryPolicy): MonoTypeOperatorFunction<T> {
  return retry({
    count: policy.retries,
    delay: (error: unknown, retryCount: number) =>
      isTransient(error)
        ? timer(policy.initialDelayMs * 2 ** (retryCount - 1))
        : throwError(() => error),
  });
}
