import { HttpErrorResponse } from '@angular/common/http';
import { defer, of, throwError, type Observable } from 'rxjs';
import { isTransient, retryTransient } from './retry-transient';

const httpError = (status: number): HttpErrorResponse => new HttpErrorResponse({ status });

describe('isTransient', () => {
  it.each([0, 500, 502, 503, 504])('retries HTTP %s', (status) => {
    expect(isTransient(httpError(status))).toBe(true);
  });

  it.each([400, 404, 422, 429])('does not retry HTTP %s', (status) => {
    expect(isTransient(httpError(status))).toBe(false);
  });

  it('does not retry errors that are not HTTP errors', () => {
    expect(isTransient(new Error('bad data'))).toBe(false);
  });
});

describe('retryTransient', () => {
  const policy = { retries: 2, initialDelayMs: 1000 };

  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  /** A source that fails with the given errors in turn, then succeeds. Records attempt times. */
  function flaky(errors: unknown[]): { source: Observable<string>; attempts: number[] } {
    const attempts: number[] = [];
    const source = defer(() => {
      attempts.push(Date.now());
      const error = errors.shift();
      return error === undefined ? of('ok') : throwError(() => error);
    });
    return { source, attempts };
  }

  function run(source: Observable<string>): { value?: string; error?: unknown } {
    const outcome: { value?: string; error?: unknown } = {};
    source.pipe(retryTransient(policy)).subscribe({
      next: (value) => (outcome.value = value),
      error: (error: unknown) => (outcome.error = error),
    });
    return outcome;
  }

  it('retries transient failures after 1 s and then 2 s', async () => {
    const start = Date.now();
    const { source, attempts } = flaky([httpError(503), httpError(0)]);
    const outcome = run(source);

    await vi.advanceTimersByTimeAsync(999);
    expect(attempts).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(attempts).toEqual([start, start + 1000, start + 3000]);
    expect(outcome).toEqual({ value: 'ok' });
  });

  it('gives up with the last error once the retries are used up', async () => {
    const last = httpError(500);
    const { source, attempts } = flaky([httpError(503), httpError(503), last]);
    const outcome = run(source);

    await vi.advanceTimersByTimeAsync(10_000);
    expect(attempts).toHaveLength(3);
    expect(outcome.error).toBe(last);
  });

  it.each([400, 429])('fails at once on HTTP %s', async (status) => {
    const error = httpError(status);
    const { source, attempts } = flaky([error]);
    const outcome = run(source);

    await vi.advanceTimersByTimeAsync(10_000);
    expect(attempts).toHaveLength(1);
    expect(outcome.error).toBe(error);
  });
});
