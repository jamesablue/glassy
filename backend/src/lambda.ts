/**
 * The AWS Lambda entry point (#38): an EventBridge rule runs it every 3 hours, and it publishes
 * `forecast.json` to the site bucket. It is the only file with AWS code; the ingest itself is the
 * same one `npm run ingest` runs. infra/ bundles this file with esbuild (NodejsFunction), and the
 * Node 24 runtime provides the AWS SDK. See infra/README.md.
 */
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { ingest, NODE_INGEST_DEPS, type IngestDeps } from './ingest/ingest';
import { DEFAULT_INGEST_SETTINGS, type IngestSettings } from './ingest/settings';
import { forecastCallCount } from './open-meteo/urls';
import { serializeSnapshot } from './write-snapshot';

/** The object the app reads, at the root of the site bucket. */
export const SNAPSHOT_KEY = 'forecast.json';

/**
 * Five minutes in browsers and at the CloudFront edge, then up to an hour of the old copy while a
 * new one is fetched. A new snapshot arrives every 3 hours, so this delays it by 5 minutes at most.
 */
export const SNAPSHOT_CACHE_CONTROL = 'public, max-age=300, stale-while-revalidate=3600';

/** Environment variable that names the bucket, set by the CDK stack. */
export const BUCKET_ENV = 'SNAPSHOT_BUCKET';

/** The one S3 call the handler makes, narrowed so a test can pass a fake. */
export interface SnapshotStore {
  send(command: PutObjectCommand): Promise<unknown>;
}

export interface PublishDeps extends IngestDeps {
  readonly s3: SnapshotStore;
  readonly log: (message: string) => void;
}

/** What a run published. It is the Lambda's result, so `aws lambda invoke` prints it. */
export interface PublishResult {
  readonly bucket: string;
  readonly key: string;
  readonly bytes: number;
  readonly hours: number;
  readonly fetchedAt: string;
}

/**
 * Fetches the forecast, validates the snapshot as the app will, and writes it to
 * `s3://<bucket>/forecast.json`. It is all or nothing: a failed request or an invalid snapshot
 * throws before anything is written, so the last good snapshot stays in place.
 *
 * @throws OpenMeteoError when a request fails
 * @throws SnapshotError when the snapshot would not pass the app's validation
 * @throws Error when S3 refuses the write
 */
export async function publishSnapshot(
  bucket: string,
  settings: IngestSettings,
  deps: PublishDeps,
): Promise<PublishResult> {
  const calls = forecastCallCount(settings, settings.spots.length);
  deps.log(`Fetching from Open-Meteo: about ${Math.round(calls.total)} weighted API calls`);
  const snapshot = await ingest(settings, deps);
  const json = serializeSnapshot(snapshot, settings);

  await deps.s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: SNAPSHOT_KEY,
      Body: json,
      // CloudFront compresses application/json, and not application/octet-stream.
      ContentType: 'application/json',
      CacheControl: SNAPSHOT_CACHE_CONTROL,
    }),
  );

  const result: PublishResult = {
    bucket,
    key: SNAPSHOT_KEY,
    bytes: Buffer.byteLength(json),
    hours: snapshot.times.length,
    fetchedAt: snapshot.fetchedAt,
  };
  deps.log(
    `Wrote s3://${bucket}/${SNAPSHOT_KEY} (${(result.bytes / 1024).toFixed(0)} kB, ` +
      `${result.hours} hours, fetched ${result.fetchedAt})`,
  );
  return result;
}

/** One client per container, reused by warm invocations. */
let s3: S3Client | undefined;

/**
 * The Lambda handler. Errors are not caught: Lambda counts the failed invocation, which is what
 * the CloudWatch alarm watches.
 */
export async function handler(): Promise<PublishResult> {
  const bucket = process.env[BUCKET_ENV];
  if (!bucket) {
    throw new Error(`${BUCKET_ENV} is not set. The CDK stack sets it to the site bucket.`);
  }
  s3 ??= new S3Client({});
  return publishSnapshot(bucket, DEFAULT_INGEST_SETTINGS, {
    ...NODE_INGEST_DEPS,
    s3,
    log: console.log,
  });
}
