import { OAHU_SPOTS, parseSnapshot, SPOT_VARIABLES } from '@glassy/shared';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readManifest, RECORDED_FIXTURES_DIR, snapshotFromFixtures } from './fixtures';
import { DEFAULT_INGEST_SETTINGS } from './settings';

/** `spot-forecast.fixture.json`: each spot's series, unpacked by the recorder on its own. */
interface SpotFixture {
  readonly recordedAt: string;
  readonly spotIds: readonly string[];
  readonly times: readonly number[];
  readonly series: Readonly<Record<string, readonly (readonly (number | null)[])[]>>;
}

describe('snapshotFromFixtures', () => {
  const spotFixture = readFile(
    join(RECORDED_FIXTURES_DIR, '../spot-forecast.fixture.json'),
    'utf8',
  ).then((text) => JSON.parse(text) as SpotFixture);

  it('builds a snapshot the app accepts, with no network', async () => {
    const snapshot = await snapshotFromFixtures(DEFAULT_INGEST_SETTINGS);
    expect(() =>
      parseSnapshot(JSON.parse(JSON.stringify(snapshot)), DEFAULT_INGEST_SETTINGS),
    ).not.toThrow();
  });

  it('dates the snapshot to the recording, so it is the same every time', async () => {
    const [snapshot, again, manifest] = await Promise.all([
      snapshotFromFixtures(DEFAULT_INGEST_SETTINGS),
      snapshotFromFixtures(DEFAULT_INGEST_SETTINGS),
      readManifest(),
    ]);
    expect(snapshot.fetchedAt).toBe(new Date(manifest.recordedAt).toISOString());
    expect(JSON.stringify(again)).toBe(JSON.stringify(snapshot));
  });

  it('holds the same spot series the recorder unpacked independently', async () => {
    const [snapshot, fixture] = await Promise.all([
      snapshotFromFixtures(DEFAULT_INGEST_SETTINGS),
      spotFixture,
    ]);
    expect(snapshot.times).toEqual(fixture.times);
    expect(snapshot.spots.ids).toEqual(fixture.spotIds);
    for (const variable of SPOT_VARIABLES) {
      const bySpot = fixture.series[variable] ?? [];
      // The fixture is spot by spot; the snapshot is hour by hour.
      const hourMajor = fixture.times.flatMap((_, hour) =>
        OAHU_SPOTS.map((_, spot) => bySpot[spot]?.[hour] ?? null),
      );
      expect(snapshot.spots.series[variable], variable).toEqual(hourMajor);
    }
  });

  it('fills the map grid around the island', async () => {
    const snapshot = await snapshotFromFixtures(DEFAULT_INGEST_SETTINGS);
    const { rows, cols } = DEFAULT_INGEST_SETTINGS.grid;
    const { windSpeed, swellHeight } = snapshot.grid.fields;
    expect(windSpeed).toHaveLength(snapshot.times.length * rows * cols);
    // `cell_selection=sea` reads the nearest sea cell, so even cells over land have marine values.
    expect(windSpeed.every((value) => value !== null)).toBe(true);
    expect(swellHeight.every((value) => value !== null && value > 0)).toBe(true);
  });
});
