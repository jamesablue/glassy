import { HttpErrorResponse } from '@angular/common/http';
import { defer, map, NEVER, Observable, of, throwError, timer } from 'rxjs';
import { ForecastTimeoutError, ForecastUnavailableError } from './forecast-errors';
import { withDeadline } from './request-deadline';
import { retryTransient } from './retry-transient';

describe('withDeadline', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function run<T>(source: Observable<T>): { value?: T; error?: unknown } {
    const outcome: { value?: T; error?: unknown } = {};
    source.subscribe({
      next: (value) => (outcome.value = value),
      error: (error: unknown) => (outcome.error = error),
    });
    return outcome;
  }

  it('lets an answer within the deadline through', async () => {
    const outcome = run(
      timer(999).pipe(
        map(() => 'ok'),
        withDeadline(1000),
      ),
    );
    await vi.advanceTimersByTimeAsync(1000);
    expect(outcome).toEqual({ value: 'ok' });
  });

  it('fails with a ForecastTimeoutError once the deadline passes, and unsubscribes', async () => {
    let unsubscribed = false;
    const hung = new Observable<string>(() => () => (unsubscribed = true));
    const outcome = run(hung.pipe(withDeadline(1000)));

    await vi.advanceTimersByTimeAsync(999);
    expect(outcome.error).toBeUndefined();
    await vi.advanceTimersByTimeAsync(1);
    expect(outcome.error).toBeInstanceOf(ForecastTimeoutError);
    expect(outcome.error).toBeInstanceOf(ForecastUnavailableError);
    expect(outcome.error).toMatchObject({ name: 'ForecastTimeoutError', timeoutMs: 1000 });
    expect(unsubscribed).toBe(true);
  });

  it('covers every attempt when put after the retries', async () => {
    const attempts: number[] = [];
    const failing = defer(() => {
      attempts.push(Date.now());
      return attempts.length < 3 ? throwError(() => new HttpErrorResponse({ status: 503 })) : NEVER;
    });
    const start = Date.now();
    const outcome = run(
      failing.pipe(retryTransient({ retries: 2, initialDelayMs: 1000 }), withDeadline(10_000)),
    );

    await vi.advanceTimersByTimeAsync(60_000);
    expect(attempts).toEqual([start, start + 1000, start + 3000]);
    expect(outcome.error).toBeInstanceOf(ForecastTimeoutError);
  });

  it('is not retried', async () => {
    let attempts = 0;
    const hung = defer(() => {
      attempts++;
      return NEVER;
    });
    const outcome = run(
      hung.pipe(withDeadline(1000), retryTransient({ retries: 2, initialDelayMs: 1 })),
    );

    await vi.advanceTimersByTimeAsync(10_000);
    expect(attempts).toBe(1);
    expect(outcome.error).toBeInstanceOf(ForecastTimeoutError);
  });

  it('passes other errors through', async () => {
    const error = new Error('bad data');
    const outcome = run(throwError(() => error).pipe(withDeadline(1000)));
    expect(outcome.error).toBe(error);
    expect(run(of(1).pipe(withDeadline(1000)))).toEqual({ value: 1 });
  });
});
