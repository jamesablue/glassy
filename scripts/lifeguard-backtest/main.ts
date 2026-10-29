/**
 * Backtests Glassy's surf estimate against Oahu lifeguard reports (NWS Surf Observations), for
 * today's scoring settings and a candidate, on the same days (#58). Writes
 * docs/lifeguard-surf-backtest.md.
 *
 * Usage: `npm run backtest:lifeguards [-- --refresh] [-- --days 92] [-- --candidate near-shore]`
 */
import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { format, resolveConfig } from 'prettier';
import { fetchOpenMeteo } from '../../backend/src/open-meteo/client';
import type { OpenMeteoResponse } from '../../backend/src/open-meteo/types';
import { DEFAULT_INGEST_SETTINGS } from '../../backend/src/ingest/settings';
import { cacheDir, cached } from '../lib/cache';
import { samplingPoints, scoreReadings } from './analysis';
import { BEACHES } from './beaches';
import { isOmrArchive, omrArchiveUrl, parseOmr } from './omr';
import { parseMarine, pastMarineUrl, SURF_MARINE_VARS } from './open-meteo';
import { renderReport, type Run } from './report';
import { BASELINE, CANDIDATES, fingerprint, type ScoringSettings } from './settings';

const REPORT = new URL('../../docs/lifeguard-surf-backtest.md', import.meta.url);
const CACHE = cacheDir('lifeguard-backtest');
const USER_AGENT = 'Glassy lifeguard backtest (https://github.com/jamesablue/glassy)';
/** Open-Meteo returns at most this many past days. */
const MAX_DAYS = 92;
const DAY_S = 86_400;

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.text();
}

/** The first day of each UTC month from `start` to `end`, as `YYYY-MM-01`. */
function monthsBetween(start: number, end: number): string[] {
  const months: string[] = [];
  const cursor = new Date(start * 1000);
  cursor.setUTCDate(1);
  while (cursor.getTime() <= end * 1000) {
    months.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return months;
}

function nextMonth(month: string): string {
  const date = new Date(`${month}T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + 1);
  return date.toISOString().slice(0, 10);
}

async function marineFor(
  settings: ScoringSettings,
  days: number,
  refresh: boolean,
): Promise<Omit<Run, 'rows'>> {
  const points = samplingPoints(BEACHES, settings);
  const url = pastMarineUrl(points, days);
  // Named by the URL, so changed settings never reuse another run's download.
  const hash = createHash('sha256').update(url).digest('hex').slice(0, 8);
  const text = await cached(
    CACHE,
    `open-meteo-${settings.name}-${hash}.json`,
    async () =>
      JSON.stringify(
        await fetchOpenMeteo(`backtest ${settings.name}`, url, DEFAULT_INGEST_SETTINGS),
      ),
    (body) => {
      const parsed: unknown = JSON.parse(body);
      return Array.isArray(parsed) && parsed.length === BEACHES.length;
    },
    refresh,
  );
  const series = parseMarine(
    JSON.parse(text) as OpenMeteoResponse<(typeof SURF_MARINE_VARS)[number]>,
  );
  return { settings, fingerprint: fingerprint(settings, BEACHES), points, series };
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      refresh: { type: 'boolean', default: false },
      days: { type: 'string', default: String(MAX_DAYS) },
      candidate: { type: 'string', default: CANDIDATES[0]?.name },
    },
  });
  const refresh = values.refresh;
  const days = Number(values.days);
  if (!Number.isInteger(days) || days < 1 || days > MAX_DAYS) {
    throw new Error(`--days must be a whole number from 1 to ${MAX_DAYS} (Open-Meteo's past days)`);
  }
  const candidate = CANDIDATES.find((settings) => settings.name === values.candidate);
  if (!candidate) {
    throw new Error(
      `--candidate must be one of: ${CANDIDATES.map((settings) => settings.name).join(', ')}`,
    );
  }

  const manifest = JSON.parse(
    await cached(
      CACHE,
      'manifest.json',
      async () => JSON.stringify({ fetchedAt: new Date().toISOString() }),
      () => true,
      refresh,
    ),
  ) as { fetchedAt: string };
  // The period is fixed by the first download, so a rerun from the cache covers the same days.
  const end = Math.floor(Date.parse(manifest.fetchedAt) / 1000);
  const start = end - days * DAY_S;

  const archives: string[] = [];
  for (const month of monthsBetween(start, end)) {
    archives.push(
      await cached(
        CACHE,
        `omr-${month.slice(0, 7)}.txt`,
        () => fetchText(omrArchiveUrl(month, nextMonth(month))),
        isOmrArchive,
        refresh,
      ),
    );
  }
  const observations = parseOmr(archives).filter(
    (observation) => observation.time >= start && observation.time <= end,
  );

  const runs = await Promise.all(
    [BASELINE, candidate].map(async (settings) => {
      const run = await marineFor(settings, days, refresh);
      return { ...run, rows: scoreReadings(observations, BEACHES, run.series, settings) };
    }),
  );
  // Compare only readings every run could score, so both tables cover the same readings.
  const key = (row: Run['rows'][number]): string =>
    `${row.observation.beach}@${row.observation.time}`;
  const common = runs
    .map((run) => new Set(run.rows.map(key)))
    .reduce((a, b) => new Set([...a].filter((entry) => b.has(entry))));
  const [baseline, compared] = runs.map((run): Run => ({
    ...run,
    rows: run.rows.filter((row) => common.has(key(row))),
  }));
  if (!baseline || !compared) throw new Error('Expected a baseline and a candidate run');

  const markdown = renderReport({
    fetchedAt: manifest.fetchedAt,
    start,
    end,
    days,
    beaches: BEACHES,
    readingCount: observations.length,
    baseline,
    candidate: compared,
  });
  const options = (await resolveConfig(REPORT)) ?? {};
  await writeFile(REPORT, await format(markdown, { ...options, parser: 'markdown' }));

  console.log(
    `${observations.length} readings, ${baseline.rows.length} scored ` +
      `(baseline ${baseline.fingerprint}, ${compared.settings.name} ${compared.fingerprint}). ` +
      `Wrote ${REPORT.pathname}`,
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
