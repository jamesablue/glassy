/**
 * Backtests Open-Meteo's swell against four NOAA buoys around Oahu, to decide how Glassy should
 * handle the island blocking swell (#55). Writes docs/buoy-swell-backtest.md.
 *
 * Usage: `npm run backtest:buoys [-- --refresh] [-- --days 45]`
 */
import { writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { format, resolveConfig } from 'prettier';
import { fetchOpenMeteo } from '../../backend/src/open-meteo/client';
import type { OpenMeteoResponse } from '../../backend/src/open-meteo/types';
import { DEFAULT_INGEST_SETTINGS } from '../../backend/src/ingest/settings';
import { metricsByMethod, rows, type BuoyData, type GeometryShift } from './analysis';
import { BUOYS, TODAY_DISTANCE_KM, UPSTREAM_DISTANCE_KM, pointOut } from './buoys';
import { cached } from './cache';
import { decide } from './metrics';
import { isSpecFile, parseSpec, specUrl } from './ndbc';
import { BACKTEST_MARINE_VARS, parseMarine, pastMarineUrl } from './open-meteo';
import { renderReport, type SensitivityCase } from './report';

const REPORT = new URL('../../docs/buoy-swell-backtest.md', import.meta.url);
const USER_AGENT = 'Glassy buoy backtest (https://github.com/jamesablue/glassy)';

const SHIFTS: readonly (GeometryShift & { readonly label: string })[] = [
  { label: 'Window −20°', facing: 0, window: -20 },
  { label: 'Window +20°', facing: 0, window: 20 },
  { label: 'Facing −15°', facing: -15, window: 0 },
  { label: 'Facing +15°', facing: 15, window: 0 },
];

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.text();
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      refresh: { type: 'boolean', default: false },
      days: { type: 'string', default: '45' },
    },
  });
  const refresh = values.refresh;
  const days = Number(values.days);
  if (!Number.isInteger(days) || days < 1 || days > 45) {
    throw new Error('--days must be a whole number from 1 to 45 (the length of the NDBC files)');
  }

  const manifest = JSON.parse(
    await cached(
      'manifest.json',
      async () => JSON.stringify({ fetchedAt: new Date().toISOString() }),
      () => true,
      refresh,
    ),
  ) as { fetchedAt: string };

  const specs = await Promise.all(
    BUOYS.map((buoy) =>
      cached(`ndbc-${buoy.id}.spec`, () => fetchText(specUrl(buoy.id)), isSpecFile, refresh),
    ),
  );

  // One request for all twelve points: the buoys (A), then the upstream points (B), then today's.
  const points = {
    A: BUOYS.map((buoy) => ({ lat: buoy.lat, lon: buoy.lon })),
    B: BUOYS.map((buoy) => pointOut(buoy, UPSTREAM_DISTANCE_KM)),
    today: BUOYS.map((buoy) => pointOut(buoy, TODAY_DISTANCE_KM)),
  };
  const url = pastMarineUrl([...points.A, ...points.B, ...points.today], days + 1);
  const marine = parseMarine(
    JSON.parse(
      await cached(
        'open-meteo-marine.json',
        async () =>
          JSON.stringify(await fetchOpenMeteo('backtest marine', url, DEFAULT_INGEST_SETTINGS)),
        (text) => {
          const parsed: unknown = JSON.parse(text);
          return Array.isArray(parsed) && parsed.length === points.A.length * 3;
        },
        refresh,
      ),
    ) as OpenMeteoResponse<(typeof BACKTEST_MARINE_VARS)[number]>,
  );
  if (marine.length !== BUOYS.length * 3) {
    throw new Error(`Expected ${BUOYS.length * 3} model locations, got ${marine.length}`);
  }

  const buoys: BuoyData[] = BUOYS.map((buoy, index) => ({
    buoy,
    hours: parseSpec(specs[index] ?? ''),
    model: {
      A: marine[index]!,
      B: marine[BUOYS.length + index]!,
      today: marine[2 * BUOYS.length + index]!,
    },
  }));

  const end = Math.max(...buoys.flatMap((data) => data.hours.map((hour) => hour.time)));
  const start = end - days * 86_400;
  const swell = buoys.flatMap((data) => rows(data, start, 'swell'));
  const total = buoys.flatMap((data) => rows(data, start, 'all'));
  // Total height decides; swell height was the first headline (see the report).
  const pooled = metricsByMethod(total);
  const pooledSwell = metricsByMethod(swell);
  const sensitivity: SensitivityCase[] = SHIFTS.map((shift) => {
    const shifted = metricsByMethod(buoys.flatMap((data) => rows(data, start, 'all', shift)));
    return { label: shift.label, b: shifted.B, decision: decide(shifted.A, shifted.B) };
  });

  const decision = decide(pooled.A, pooled.B);
  const markdown = renderReport({
    fetchedAt: manifest.fetchedAt,
    start,
    end,
    buoys,
    swell,
    total,
    decision,
    swellDecision: decide(pooledSwell.A, pooledSwell.B),
    sensitivity,
  });
  const options = (await resolveConfig(REPORT)) ?? {};
  await writeFile(REPORT, await format(markdown, { ...options, parser: 'markdown' }));

  console.log(
    `${total.length} buoy hours, total height. MAE A ${pooled.A.mae.toFixed(3)} m, B ${pooled.B.mae.toFixed(3)} m, ` +
      `today ${pooled.today.mae.toFixed(3)} m. Decision: ${decision.choice}` +
      `${decision.tie ? ' (tie)' : ''}${decision.poor ? ', both poor' : ''}. Wrote ${REPORT.pathname}`,
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
