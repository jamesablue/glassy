import { parseSnapshot, type ForecastSnapshot, type SnapshotExpectations } from '@glassy/shared';
import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

/**
 * Validates a snapshot as the app will, then writes it as compact JSON. It is written to a
 * temporary file first and renamed into place, so a reader (the dev server) never sees half a file,
 * and an invalid snapshot leaves the previous file as it was.
 *
 * @returns the number of bytes written
 * @throws SnapshotError when the snapshot would not pass the app's validation
 */
export async function writeSnapshot(
  snapshot: ForecastSnapshot,
  path: string,
  expected: SnapshotExpectations,
): Promise<number> {
  const json = JSON.stringify(snapshot);
  parseSnapshot(JSON.parse(json), expected);

  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.tmp`;
  try {
    await writeFile(temporary, json);
    await rename(temporary, path);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
  return Buffer.byteLength(json);
}
