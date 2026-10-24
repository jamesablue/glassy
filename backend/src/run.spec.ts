import { parseSnapshot } from '@glassy/shared';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Mock } from 'vitest';
import { readManifest } from './ingest/fixtures';
import { DEFAULT_INGEST_SETTINGS } from './ingest/settings';
import type { ForecastRequestId } from './open-meteo/urls';
import { run, type RunDeps } from './run';
import { recordedNetwork as recordedNetworkDeps } from './testing/recorded-network';

describe('run', () => {
  let dir: string;
  let out: string;
  const settings = { ...DEFAULT_INGEST_SETTINGS, retry: { retries: 1, initialDelayMs: 0 } };

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'glassy-backend-'));
    out = join(dir, 'forecast.json');
  });

  afterEach(() => rm(dir, { recursive: true, force: true }));

  /** The recorded network, plus a log to check. */
  async function recordedNetwork(
    failing?: ForecastRequestId,
  ): Promise<RunDeps & { fetch: Mock<RunDeps['fetch']>; log: Mock<RunDeps['log']> }> {
    return { ...(await recordedNetworkDeps(failing)), log: vi.fn<RunDeps['log']>() };
  }

  async function written(): Promise<unknown> {
    return JSON.parse(await readFile(out, 'utf8'));
  }

  it('fetches the four requests and writes a valid snapshot', async () => {
    const deps = await recordedNetwork();
    await run(['--out', out], settings, deps);

    expect(deps.fetch).toHaveBeenCalledTimes(4);
    const snapshot = parseSnapshot(await written(), settings);
    expect(snapshot.fetchedAt).toBe('2027-01-15T08:00:00.000Z');
    expect(deps.log).toHaveBeenCalledWith('Fetching from Open-Meteo: about 388 weighted API calls');
  });

  it('builds the snapshot from the recorded fixtures without the network', async () => {
    const deps = await recordedNetwork();
    await run(['--fixtures', '--out', out], settings, deps);

    expect(deps.fetch).not.toHaveBeenCalled();
    const { recordedAt } = await readManifest();
    expect(parseSnapshot(await written(), settings).fetchedAt).toBe(
      new Date(recordedAt).toISOString(),
    );
  });

  it('writes nothing when one request fails, and leaves the last snapshot in place', async () => {
    await writeFile(out, '{"previous":true}');
    const deps = await recordedNetwork('gridWind');

    await expect(run(['--out', out], settings, deps)).rejects.toThrow('grid wind: Not recorded');
    // The failing request was retried once; the others were asked once.
    expect(deps.fetch).toHaveBeenCalledTimes(5);
    expect(await written()).toEqual({ previous: true });
    expect(await readdir(dir)).toEqual(['forecast.json']);
  });

  it('refuses unknown options', async () => {
    await expect(run(['--outt', out], settings, await recordedNetwork())).rejects.toThrow(
      /Unknown option '--outt'/,
    );
  });

  it('prints the usage for --help', async () => {
    const deps = await recordedNetwork();
    await run(['--help'], settings, deps);
    expect(deps.log).toHaveBeenCalledWith(expect.stringContaining('npm run snapshot:fixtures'));
    expect(deps.fetch).not.toHaveBeenCalled();
  });
});
