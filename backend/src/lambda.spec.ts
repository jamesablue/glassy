import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { parseSnapshot } from '@glassy/shared';
import { readManifest } from './ingest/fixtures';
import { DEFAULT_INGEST_SETTINGS } from './ingest/settings';
import {
  BUCKET_ENV,
  handler,
  publishSnapshot,
  SNAPSHOT_CACHE_CONTROL,
  SNAPSHOT_KEY,
  type PublishDeps,
} from './lambda';
import { RECORDED_RUN_AT, recordedNetwork } from './testing/recorded-network';

const BUCKET = 'glassy-site-bucket';
const settings = { ...DEFAULT_INGEST_SETTINGS, retry: { retries: 1, initialDelayMs: 0 } };

/** The recorded network, a fake S3 client, and a log. */
async function publishDeps(...args: Parameters<typeof recordedNetwork>) {
  return {
    ...(await recordedNetwork(...args)),
    s3: { send: vi.fn<PublishDeps['s3']['send']>().mockResolvedValue({}) },
    log: vi.fn<PublishDeps['log']>(),
  };
}

/** The input of every command the fake S3 client was sent. */
function putInputs(send: PublishDeps['s3']['send']): PutObjectCommand['input'][] {
  return vi.mocked(send).mock.calls.map(([command]) => {
    expect(command).toBeInstanceOf(PutObjectCommand);
    return command.input;
  });
}

describe('publishSnapshot', () => {
  it('fetches the four requests and writes one valid forecast.json', async () => {
    const deps = await publishDeps();

    const result = await publishSnapshot(BUCKET, settings, deps);

    expect(deps.fetch).toHaveBeenCalledTimes(4);
    const [input, ...others] = putInputs(deps.s3.send);
    expect(others).toEqual([]);
    expect(input).toMatchObject({
      Bucket: BUCKET,
      Key: 'forecast.json',
      ContentType: 'application/json',
      CacheControl: 'public, max-age=300, stale-while-revalidate=3600',
    });
    const snapshot = parseSnapshot(JSON.parse(String(input?.Body)), settings);
    expect(snapshot.fetchedAt).toBe(RECORDED_RUN_AT.toISOString());
    expect(result).toEqual({
      bucket: BUCKET,
      key: SNAPSHOT_KEY,
      bytes: Buffer.byteLength(String(input?.Body)),
      hours: snapshot.times.length,
      fetchedAt: snapshot.fetchedAt,
    });
    expect(deps.log).toHaveBeenLastCalledWith(
      expect.stringContaining(`Wrote s3://${BUCKET}/forecast.json`),
    );
  });

  it('writes nothing when a request fails, so the last snapshot stays in place', async () => {
    const deps = await publishDeps('spotMarine');

    await expect(publishSnapshot(BUCKET, settings, deps)).rejects.toThrow('spot marine');
    // The failing request was retried once; the others were asked once.
    expect(deps.fetch).toHaveBeenCalledTimes(5);
    expect(deps.s3.send).not.toHaveBeenCalled();
  });

  it('writes nothing when a response is incomplete', async () => {
    const deps = await publishDeps();
    const { openMeteo } = await readManifest();
    const recorded = deps.fetch.getMockImplementation();
    // The grid wind response comes back an hour short at one location.
    deps.fetch.mockImplementation(async (input, init) => {
      const response = await recorded!(input, init);
      if (String(input) !== openMeteo.requests.gridWind.url) return response;
      const [first, ...rest] = (await response.json()) as { hourly: Record<string, unknown[]> }[];
      for (const series of Object.values(first!.hourly)) series.pop();
      return new Response(JSON.stringify([first, ...rest]));
    });

    await expect(publishSnapshot(BUCKET, settings, deps)).rejects.toThrow(
      'The grid wind response has locations on different hours',
    );
    expect(deps.s3.send).not.toHaveBeenCalled();
  });

  it('fails when S3 refuses the write', async () => {
    const deps = await publishDeps();
    deps.s3.send.mockRejectedValue(new Error('AccessDenied'));

    await expect(publishSnapshot(BUCKET, settings, deps)).rejects.toThrow('AccessDenied');
  });
});

describe('handler', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('publishes to the bucket named in the environment', async () => {
    vi.stubEnv(BUCKET_ENV, BUCKET);
    const network = await recordedNetwork();
    vi.stubGlobal('fetch', network.fetch);
    const send = vi.spyOn(S3Client.prototype, 'send').mockResolvedValue({} as never);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const result = await handler();

    expect(network.fetch).toHaveBeenCalledTimes(4);
    expect(send).toHaveBeenCalledTimes(1);
    const [command] = send.mock.calls[0]!;
    expect(command).toBeInstanceOf(PutObjectCommand);
    expect((command as PutObjectCommand).input).toMatchObject({
      Bucket: BUCKET,
      Key: SNAPSHOT_KEY,
      CacheControl: SNAPSHOT_CACHE_CONTROL,
    });
    expect(result).toMatchObject({ bucket: BUCKET, key: SNAPSHOT_KEY });
  });

  it('fails before fetching when the bucket is not configured', async () => {
    vi.stubEnv(BUCKET_ENV, '');
    const fetch = vi.fn<typeof globalThis.fetch>();
    vi.stubGlobal('fetch', fetch);

    await expect(handler()).rejects.toThrow(`${BUCKET_ENV} is not set`);
    expect(fetch).not.toHaveBeenCalled();
  });
});
