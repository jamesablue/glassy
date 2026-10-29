import { mkdir, readFile, writeFile } from 'node:fs/promises';

/** A folder for one script's downloads, gitignored with the rest of `.local/`. */
export function cacheDir(name: string): URL {
  return new URL(`../../.local/${name}/`, import.meta.url);
}

/**
 * The cached copy of a download in `dir`, fetched first if it isn't cached yet or `refresh` is
 * set. Live sources roll over (NDBC files every half hour, the NWS archive daily), so the cache is
 * what makes a rerun give the same report. A download is written only once `isValid` accepts it,
 * so an error page or a cut-off response is never cached and replayed by later runs.
 */
export async function cached(
  dir: URL,
  file: string,
  download: () => Promise<string>,
  isValid: (text: string) => boolean,
  refresh: boolean,
): Promise<string> {
  const path = new URL(file, dir);
  if (!refresh) {
    try {
      return await readFile(path, 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
  const text = await download();
  if (!isValid(text)) throw new Error(`${file}: the download isn't in the expected format`);
  await mkdir(dir, { recursive: true });
  await writeFile(path, text);
  return text;
}
