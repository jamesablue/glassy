import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Mock } from 'vitest';
import { readManifest, RECORDED_FIXTURES_DIR } from '../ingest/fixtures';
import type { IngestDeps } from '../ingest/ingest';
import type { ForecastRequestId } from '../open-meteo/urls';

/** The recording's fetch time, as `now()` for every run that uses these deps. */
export const RECORDED_RUN_AT = new Date('2027-01-15T08:00:00Z');

/**
 * Ingest deps whose `fetch` answers the recorded URLs with the recorded bodies, except the
 * `failing` request, which gets a 503 every time. No waiting between retries.
 */
export async function recordedNetwork(
  failing?: ForecastRequestId,
): Promise<IngestDeps & { fetch: Mock<IngestDeps['fetch']> }> {
  const { openMeteo } = await readManifest();
  const bodies = new Map<string, string>();
  for (const [id, { file, url }] of Object.entries(openMeteo.requests)) {
    bodies.set(
      url,
      id === failing ? '' : await readFile(join(RECORDED_FIXTURES_DIR, file), 'utf8'),
    );
  }
  return {
    fetch: vi.fn<IngestDeps['fetch']>(async (input) => {
      const body = bodies.get(String(input));
      return body
        ? new Response(body)
        : new Response(JSON.stringify({ error: true, reason: 'Not recorded' }), { status: 503 });
    }),
    sleep: async () => undefined,
    now: () => RECORDED_RUN_AT,
  };
}
