import { fetchOpenMeteo, isTransient, OpenMeteoError, type FetchDeps } from './client';

describe('fetchOpenMeteo', () => {
  const url = 'https://api.example.com/v1/forecast?latitude=21';
  const settings = { timeoutMs: 5_000, retry: { retries: 2, initialDelayMs: 1_000 } };

  /** Deps whose `fetch` answers with each of `answers` in turn, recording calls and waits. */
  function fakeDeps(...answers: (Response | Error)[]): FetchDeps & { waits: number[] } {
    const waits: number[] = [];
    const fetch = vi.fn(async () => {
      const answer = answers.shift();
      if (!answer) throw new Error('No more answers');
      if (answer instanceof Error) throw answer;
      return answer;
    });
    return { fetch, sleep: async (ms) => void waits.push(ms), waits };
  }

  const json = (body: unknown, status = 200): Response =>
    new Response(JSON.stringify(body), { status });

  async function failure(promise: Promise<unknown>): Promise<OpenMeteoError> {
    const error = await promise.then(
      () => undefined,
      (error: unknown) => error,
    );
    expect(error).toBeInstanceOf(OpenMeteoError);
    return error as OpenMeteoError;
  }

  it('returns the parsed body', async () => {
    const deps = fakeDeps(json({ hourly: { time: [1] } }));
    expect(await fetchOpenMeteo('spot weather', url, settings, deps)).toEqual({
      hourly: { time: [1] },
    });
    expect(deps.fetch).toHaveBeenCalledWith(url, { signal: expect.any(AbortSignal) });
  });

  it('retries server errors and dropped connections, waiting twice as long each time', async () => {
    const deps = fakeDeps(json({}, 503), new TypeError('fetch failed'), json({ ok: true }));
    expect(await fetchOpenMeteo('grid wind', url, settings, deps)).toEqual({ ok: true });
    expect(deps.fetch).toHaveBeenCalledTimes(3);
    expect(deps.waits).toEqual([1_000, 2_000]);
  });

  it('gives up after the last retry', async () => {
    const deps = fakeDeps(json({}, 502), json({}, 502), json({}, 502));
    const error = await failure(fetchOpenMeteo('grid wind', url, settings, deps));
    expect(error).toMatchObject({ kind: 'http', status: 502, message: 'grid wind: HTTP 502' });
    expect(deps.fetch).toHaveBeenCalledTimes(3);
  });

  it('does not retry a rate limit, and reports Open-Meteo’s reason', async () => {
    const deps = fakeDeps(json({ error: true, reason: 'Daily API request limit exceeded' }, 429));
    const error = await failure(fetchOpenMeteo('grid marine', url, settings, deps));
    expect(error).toMatchObject({
      kind: 'http',
      status: 429,
      message: 'grid marine: Daily API request limit exceeded',
    });
    expect(deps.fetch).toHaveBeenCalledTimes(1);
  });

  it('does not retry a timeout', async () => {
    const timeout = new DOMException('The operation was aborted due to timeout', 'TimeoutError');
    const deps = fakeDeps(timeout);
    const error = await failure(fetchOpenMeteo('spot marine', url, settings, deps));
    expect(error).toMatchObject({ kind: 'timeout', message: 'spot marine: no answer within 5 s' });
    expect(deps.fetch).toHaveBeenCalledTimes(1);
  });

  it('aborts an attempt that outlasts the timeout', async () => {
    const deps: FetchDeps = {
      fetch: (_, init) =>
        new Promise((_, reject) =>
          init?.signal?.addEventListener('abort', () => reject(init.signal?.reason)),
        ),
      sleep: async () => undefined,
    };
    const quick = { ...settings, timeoutMs: 10 };
    expect(await failure(fetchOpenMeteo('spot marine', url, quick, deps))).toMatchObject({
      kind: 'timeout',
    });
  });

  it('reports a body that is not JSON as malformed, without retrying', async () => {
    const deps = fakeDeps(new Response('<html>', { status: 200 }));
    const error = await failure(fetchOpenMeteo('spot weather', url, settings, deps));
    expect(error.kind).toBe('malformed');
    expect(deps.fetch).toHaveBeenCalledTimes(1);
  });

  it('falls back to the status when an error body has no reason', async () => {
    const deps = fakeDeps(new Response('Bad Request', { status: 400 }));
    const error = await failure(fetchOpenMeteo('spot weather', url, settings, deps));
    expect(error.message).toBe('spot weather: HTTP 400');
  });
});

describe('isTransient', () => {
  it.each([
    [new OpenMeteoError('network', 'x'), true],
    [new OpenMeteoError('http', 'x', 500), true],
    [new OpenMeteoError('http', 'x', 429), false],
    [new OpenMeteoError('http', 'x', 404), false],
    [new OpenMeteoError('timeout', 'x'), false],
    [new OpenMeteoError('malformed', 'x'), false],
    [new Error('x'), false],
  ])('%s → %s', (error, transient) => {
    expect(isTransient(error)).toBe(transient);
  });
});
