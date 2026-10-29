import { mkdir, readFile, writeFile } from 'node:fs/promises';

/** Downloads live here, gitignored with the rest of `.local/`. */
export const CACHE_DIR = new URL('../../.local/buoy-backtest/', import.meta.url);

/**
 * The cached copy of a download, fetched first if it isn't cached yet or `refresh` is set. The NDBC
 * files roll over every half hour, so the cache is what makes a rerun give the same report. A
 * download is written only once `isValid` accepts it, so an error page or a cut-off response is
 * never cached and replayed by later runs.
 */
export async function cached(
  file: string,
  download: () => Promise<string>,
  isValid: (text: string) => boolean,
  refresh: boolean,
): Promise<string> {
  const path = new URL(file, CACHE_DIR);
  if (!refresh) {
    try {
      return await readFile(path, 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
  const text = await download();
  if (!isValid(text)) throw new Error(`${file}: the download isn't in the expected format`);
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(path, text);
  return text;
}
