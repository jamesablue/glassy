import type { ForecastSnapshot } from '@glassy/shared';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { OpenMeteoForecastResponses } from '../open-meteo/types';
import type { ForecastRequestId } from '../open-meteo/urls';
import { buildSnapshot } from './build-snapshot';
import type { IngestSettings } from './settings';

/** The raw responses `npm run fixtures:record` writes (see src/testing/fixtures/README.md). */
export const RECORDED_FIXTURES_DIR = fileURLToPath(
  new URL('../../../src/testing/fixtures/raw/', import.meta.url),
);

/**
 * The snapshot built from those responses, committed for the app's decoder test, which may not
 * import the backend. Regenerate it with `npm run snapshot:fixtures -- --out <this path>`.
 */
export const SNAPSHOT_FIXTURE_PATH = fileURLToPath(
  new URL('../../../src/testing/fixtures/forecast-snapshot.json', import.meta.url),
);

/** The parts of `manifest.json` read here. */
interface Manifest {
  readonly recordedAt: string;
  readonly openMeteo: {
    readonly requests: Readonly<
      Record<ForecastRequestId, { readonly file: string; readonly url: string }>
    >;
  };
}

/** The recording's manifest: when it was made, and the file and URL behind each response. */
export async function readManifest(dir = RECORDED_FIXTURES_DIR): Promise<Manifest> {
  return JSON.parse(await readFile(join(dir, 'manifest.json'), 'utf8')) as Manifest;
}

/**
 * A snapshot built from recorded responses, with no network. `fetchedAt` is the recording time,
 * so the same recording always gives the same snapshot, and it is as old as the recorded forecast
 * is to a test whose clock is pinned to the recording.
 *
 * @param dir a folder laid out like `src/testing/fixtures/raw/`
 */
export async function snapshotFromFixtures(
  settings: Pick<IngestSettings, 'spots' | 'grid'>,
  dir = RECORDED_FIXTURES_DIR,
): Promise<ForecastSnapshot> {
  const manifest = await readManifest(dir);
  const responses = Object.fromEntries(
    await Promise.all(
      Object.entries(manifest.openMeteo.requests).map(async ([id, { file }]) => [
        id,
        JSON.parse(await readFile(join(dir, file), 'utf8')) as unknown,
      ]),
    ),
  ) as OpenMeteoForecastResponses;
  return buildSnapshot(responses, {
    spots: settings.spots,
    grid: settings.grid,
    fetchedAt: new Date(manifest.recordedAt),
  });
}
