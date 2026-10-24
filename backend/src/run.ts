import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { RECORDED_FIXTURES_DIR, snapshotFromFixtures } from './ingest/fixtures';
import { ingest, NODE_INGEST_DEPS, type IngestDeps } from './ingest/ingest';
import { DEFAULT_INGEST_SETTINGS, type IngestSettings } from './ingest/settings';
import { forecastCallCount } from './open-meteo/urls';
import { writeSnapshot } from './write-snapshot';

/** Where both commands write by default: git-ignored, and served as `/forecast.json` by `npm start`. */
export const DEFAULT_SNAPSHOT_PATH = fileURLToPath(
  new URL('../../.local/forecast.json', import.meta.url),
);

export const USAGE = `Usage:
  npm run ingest [-- --out <path>]
      Fetch the forecast from Open-Meteo (about 388 weighted API calls).
  npm run snapshot:fixtures [-- --dir <raw fixtures> --out <path>]
      Build it from the recorded fixtures, with no network.

Writes ${DEFAULT_SNAPSHOT_PATH} unless --out is given.`;

export interface RunDeps extends IngestDeps {
  readonly log: (message: string) => void;
}

/**
 * The command line: `--fixtures` builds a snapshot from the recorded fixtures, otherwise it is
 * fetched from Open-Meteo. Nothing is written unless the whole snapshot was built and validates.
 *
 * @throws Error for bad arguments, a failed request or an invalid snapshot
 */
export async function run(
  argv: readonly string[],
  settings: IngestSettings = DEFAULT_INGEST_SETTINGS,
  deps: RunDeps = { ...NODE_INGEST_DEPS, log: console.log },
): Promise<void> {
  const { values } = parseArgs({
    args: [...argv],
    options: {
      fixtures: { type: 'boolean', default: false },
      dir: { type: 'string', default: RECORDED_FIXTURES_DIR },
      out: { type: 'string', default: DEFAULT_SNAPSHOT_PATH },
      help: { type: 'boolean', default: false },
    },
    strict: true,
  });
  if (values.help) {
    deps.log(USAGE);
    return;
  }

  let snapshot;
  if (values.fixtures) {
    snapshot = await snapshotFromFixtures(settings, values.dir);
  } else {
    const calls = forecastCallCount(settings, settings.spots.length);
    deps.log(`Fetching from Open-Meteo: about ${Math.round(calls.total)} weighted API calls`);
    snapshot = await ingest(settings, deps);
  }

  const bytes = await writeSnapshot(snapshot, values.out, settings);
  deps.log(
    `Wrote ${values.out} (${(bytes / 1024).toFixed(0)} kB, ${snapshot.times.length} hours, ` +
      `fetched ${snapshot.fetchedAt})`,
  );
}
