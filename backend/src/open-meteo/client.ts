/** Fetches one Open-Meteo request in Node, with a timeout and a modest retry. */

export interface RetryPolicy {
  /** Retries after the first attempt. */
  readonly retries: number;
  /** Wait before the first retry, ms. Each later retry waits twice as long as the one before. */
  readonly initialDelayMs: number;
}

export interface FetchSettings {
  /** How long one attempt may take before it is aborted, ms. */
  readonly timeoutMs: number;
  readonly retry: RetryPolicy;
}

/** What the client needs from its surroundings, so tests can supply fakes. */
export interface FetchDeps {
  readonly fetch: typeof globalThis.fetch;
  readonly sleep: (ms: number) => Promise<void>;
}

export const NODE_FETCH_DEPS: FetchDeps = {
  fetch: (input, init) => globalThis.fetch(input, init),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

/**
 * Why a request failed:
 *
 * - `network`: no answer at all (DNS, connection reset, offline)
 * - `http`: an error status, with Open-Meteo's `reason` in the message when it sent one
 * - `timeout`: no answer within `timeoutMs`
 * - `malformed`: an answer that is not JSON
 */
export type OpenMeteoErrorKind = 'network' | 'http' | 'timeout' | 'malformed';

export class OpenMeteoError extends Error {
  override readonly name = 'OpenMeteoError';

  constructor(
    readonly kind: OpenMeteoErrorKind,
    message: string,
    /** The HTTP status, for `http` errors. */
    readonly status?: number,
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}

/**
 * Network failures and 5xx responses: problems that often clear up within seconds. A 4xx stays
 * wrong however often it is sent, and retrying a 429 only eats further into the rate limit. A
 * timeout is not retried either: an upstream slow enough to time out only gets slower when it is
 * asked twice. Every retry of a grid request costs another 165 weighted calls, so the default
 * policy retries once.
 */
export function isTransient(error: unknown): boolean {
  return (
    error instanceof OpenMeteoError &&
    (error.kind === 'network' || (error.kind === 'http' && (error.status ?? 0) >= 500))
  );
}

/**
 * GETs `url` and returns the parsed JSON body, retrying transient failures with exponential
 * backoff. Each attempt is aborted after `settings.timeoutMs`.
 *
 * @param label names the request in error messages (the URLs run to thousands of characters)
 * @throws OpenMeteoError when the last attempt fails
 */
export async function fetchOpenMeteo(
  label: string,
  url: string,
  settings: FetchSettings,
  deps: FetchDeps = NODE_FETCH_DEPS,
): Promise<unknown> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fetchOnce(label, url, settings.timeoutMs, deps);
    } catch (error) {
      if (attempt >= settings.retry.retries || !isTransient(error)) throw error;
      await deps.sleep(settings.retry.initialDelayMs * 2 ** attempt);
    }
  }
}

async function fetchOnce(
  label: string,
  url: string,
  timeoutMs: number,
  deps: FetchDeps,
): Promise<unknown> {
  let response: Response;
  try {
    response = await deps.fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  } catch (error) {
    if (error instanceof Error && error.name === 'TimeoutError') {
      throw new OpenMeteoError(
        'timeout',
        `${label}: no answer within ${Math.round(timeoutMs / 1000)} s`,
        undefined,
        { cause: error },
      );
    }
    throw new OpenMeteoError('network', `${label}: Open-Meteo could not be reached`, undefined, {
      cause: error,
    });
  }

  const text = await response.text();
  if (!response.ok) {
    const reason = reasonOf(text) ?? `HTTP ${response.status}`;
    throw new OpenMeteoError('http', `${label}: ${reason}`, response.status);
  }
  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    throw new OpenMeteoError('malformed', `${label}: the answer is not JSON`, undefined, {
      cause: error,
    });
  }
}

/** Open-Meteo explains errors in a JSON body: `{ "error": true, "reason": "…" }`. */
function reasonOf(body: string): string | undefined {
  try {
    const parsed: unknown = JSON.parse(body);
    if (typeof parsed === 'object' && parsed !== null && 'reason' in parsed) {
      return typeof parsed.reason === 'string' && parsed.reason !== '' ? parsed.reason : undefined;
    }
  } catch {
    // Not JSON: fall back to the status.
  }
  return undefined;
}
