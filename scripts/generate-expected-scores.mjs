/**
 * Writes src/testing/fixtures/spot-forecast.expected.json: the snorkel score, surf height and
 * ranking that the original prototype produced for every spot and hour of the recorded fixture.
 *
 * The scoring code in the middle section is copied verbatim from the prototype (app.js), changed
 * only by Prettier's formatting, and the spot table keeps the prototype's scoring fields
 * (spots.js). Nothing here imports src/app/domain, so the golden test compares the TypeScript port
 * against an independent implementation.
 * Do not refactor this copy. If the scoring model changes on purpose, change this copy to match
 * and regenerate, so the change shows up as a reviewable diff in the expected values.
 *
 * Usage: npm run fixtures:expected
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { format, resolveConfig } from 'prettier';

const FIXTURE_PATH = fileURLToPath(
  new URL('../src/testing/fixtures/spot-forecast.fixture.json', import.meta.url),
);
const OUTPUT_PATH = fileURLToPath(
  new URL('../src/testing/fixtures/spot-forecast.expected.json', import.meta.url),
);

// Scoring fields from the prototype's spots.js, in its order.
const SPOTS = [
  { id: 'sharks', facing: 300, window: 90, shelter: 0.15 },
  { id: 'tables', facing: 295, window: 90, shelter: 0.1 },
  { id: 'waimea', facing: 315, window: 90, shelter: 0.05 },
  { id: 'laniakea', facing: 320, window: 90, shelter: 0.2 },
  { id: 'mokuleia', facing: 355, window: 85, shelter: 0.2 },
  { id: 'kuilima', facing: 10, window: 80, shelter: 0.7 },
  { id: 'malaekahana', facing: 75, window: 80, shelter: 0.25 },
  { id: 'kahana', facing: 45, window: 60, shelter: 0.45 },
  { id: 'kualoa', facing: 70, window: 70, shelter: 0.55 },
  { id: 'sandbar', facing: 45, window: 60, shelter: 0.85 },
  { id: 'kailua', facing: 75, window: 80, shelter: 0.3 },
  { id: 'lanikai', facing: 85, window: 80, shelter: 0.4 },
  { id: 'waimanalo', facing: 70, window: 80, shelter: 0.2 },
  { id: 'kaupo', facing: 80, window: 70, shelter: 0.5 },
  { id: 'hanauma', facing: 140, window: 55, shelter: 0.55 },
  { id: 'chinawalls', facing: 185, window: 80, shelter: 0 },
  { id: 'kahala', facing: 170, window: 80, shelter: 0.45 },
  { id: 'diamondhead', facing: 190, window: 85, shelter: 0.1 },
  { id: 'kaimana', facing: 215, window: 80, shelter: 0.35 },
  { id: 'magicisland', facing: 190, window: 60, shelter: 0.85 },
  { id: 'koolina', facing: 230, window: 60, shelter: 0.8 },
  { id: 'electric', facing: 260, window: 85, shelter: 0 },
  { id: 'pokai', facing: 245, window: 70, shelter: 0.7 },
  { id: 'makaha', facing: 270, window: 85, shelter: 0.05 },
  { id: 'makua', facing: 265, window: 85, shelter: 0.05 },
];

// Fixture series behind each Open-Meteo variable the prototype reads.
const SPOT_MARINE_SERIES = {
  swell_wave_height: 'swellHeight',
  swell_wave_direction: 'swellDirection',
  swell_wave_period: 'swellPeriod',
  secondary_swell_wave_height: 'secondarySwellHeight',
  secondary_swell_wave_direction: 'secondarySwellDirection',
  secondary_swell_wave_period: 'secondarySwellPeriod',
  wind_wave_height: 'windWaveHeight',
  wind_wave_direction: 'windWaveDirection',
  wind_wave_period: 'windWavePeriod',
  sea_surface_temperature: 'seaSurfaceTemperature',
  ocean_current_velocity: 'currentSpeed',
  ocean_current_direction: 'currentDirection',
  sea_level_height_msl: 'seaLevel',
};
const SPOT_WIND_SERIES = {
  wind_speed_10m: 'windSpeed',
  wind_direction_10m: 'windDirection',
  wind_gusts_10m: 'windGust',
  is_day: 'isDay',
  precipitation_probability: 'rainChance',
};

/* ---------- verbatim from the prototype's app.js ---------- */
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

function piecewise(table, x) {
  if (!(x > table[0][0])) return table[0][1];
  for (let i = 1; i < table.length; i++) {
    if (x <= table[i][0]) {
      const [x0, y0] = table[i - 1],
        [x1, y1] = table[i];
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
  }
  return table[table.length - 1][1];
}
const SURF_PENALTY = [
  [0, 0],
  [0.5, 0.2],
  [1, 0.8],
  [2, 2.5],
  [3, 4.5],
  [4, 6.5],
  [5, 8],
  [6, 9.5],
  [8, 10],
]; // surf ft → points
const WIND_PENALTY = [
  [0, 0],
  [6, 0.3],
  [10, 1.2],
  [15, 2.6],
  [20, 4.2],
  [25, 5.8],
  [35, 8],
]; // effective kt → points
const CURRENT_PENALTY = [
  [0, 0],
  [0.5, 0],
  [1, 0.6],
  [2, 2],
]; // kt → points

const angDiff = (a, b) => Math.abs(((((a - b) % 360) + 540) % 360) - 180);
// Fraction of a wave component that reaches a spot, given where it comes from
function exposure(dir, spot) {
  const d = angDiff(dir, spot.facing),
    w = spot.window || 80;
  if (d <= w) return 0.25 + 0.75 * Math.cos(((d / w) * Math.PI) / 2);
  if (d <= w + 45) return 0.25 * (1 - (d - w) / 45);
  return 0;
}
// Longer-period swell shoals into bigger surf than its offshore height suggests
const periodFactor = (T) => clamp(0.5 + 0.065 * T, 0.8, 1.7);

let D = null; // prepared data

// Full snorkel conditions for a spot at an hour
function spotCond(p, t) {
  const s = SPOTS[p],
    M = D.sm.v,
    W = D.sw.v,
    k = t * D.sm.n + p,
    kw = t * D.sw.n + p;
  const comps = [
    {
      name: 'Primary swell',
      h: M.swell_wave_height[k],
      T: M.swell_wave_period[k],
      dir: M.swell_wave_direction[k],
    },
    {
      name: 'Secondary swell',
      h: M.secondary_swell_wave_height[k],
      T: M.secondary_swell_wave_period[k],
      dir: M.secondary_swell_wave_direction[k],
    },
    {
      name: 'Wind waves',
      h: M.wind_wave_height[k],
      T: M.wind_wave_period[k],
      dir: M.wind_wave_direction[k],
    },
  ];
  let e2 = 0;
  for (const c of comps) {
    c.ok = Number.isFinite(c.h) && Number.isFinite(c.dir);
    if (!c.ok) continue;
    c.exp = exposure(c.dir, s);
    c.surf = c.h * c.exp * periodFactor(Number.isFinite(c.T) ? c.T : 8);
    e2 += c.surf * c.surf;
  }
  const surf = Math.sqrt(e2) * (1 - s.shelter); // meters
  const windMs = W.wind_speed_10m[kw],
    windDir = W.wind_direction_10m[kw];
  const rel = angDiff(windDir, s.facing); // 0 = straight onshore, 180 = offshore
  const windEff =
    windMs * 1.943844 * (0.6 + 0.4 * Math.cos((rel * Math.PI) / 180)) * (1 - 0.45 * s.shelter);
  const curKt =
    (Number.isFinite(M.ocean_current_velocity[k]) ? M.ocean_current_velocity[k] : 0) / 1.852;
  const pSurf = piecewise(SURF_PENALTY, surf * 3.28084);
  const pWind = Number.isFinite(windEff) ? piecewise(WIND_PENALTY, windEff) : 0;
  const pCur = piecewise(CURRENT_PENALTY, curKt) * (1 - s.shelter);
  return {
    score: clamp(10 - pSurf - pWind - pCur, 0, 10),
    surf,
    comps,
    windMs,
    windDir,
    gust: W.wind_gusts_10m[kw],
    rel,
    windEff,
    windKind: rel < 45 ? 'onshore' : rel > 135 ? 'offshore' : 'cross-shore',
    sst: M.sea_surface_temperature[k],
    curKt,
    curDir: M.ocean_current_direction[k],
    sea: M.sea_level_height_msl[k],
    seaNext: t + 1 < D.nt ? M.sea_level_height_msl[k + D.sm.n] : NaN,
    rain: W.precipitation_probability[kw],
    isDay: D.isDay[t],
  };
}
const scoreAt = (p, t) => D.scores[p * D.nt + t];
/* ---------- end of verbatim copy ---------- */

/** The prototype's `pack`: one Float32Array per variable, indexed [t * n + location], NaN = missing. */
function pack(perSpot) {
  const nt = perSpot[0].length,
    n = perSpot.length;
  const a = new Float32Array(nt * n).fill(NaN);
  perSpot.forEach((arr, p) => {
    for (let t = 0; t < nt; t++) if (arr[t] != null) a[t * n + p] = arr[t];
  });
  return a;
}

function packAll(fixture, seriesByVariable) {
  return Object.fromEntries(
    Object.entries(seriesByVariable).map(([variable, series]) => [
      variable,
      pack(fixture.series[series]),
    ]),
  );
}

async function main() {
  const fixture = JSON.parse(await readFile(FIXTURE_PATH, 'utf8'));
  if (fixture.spotIds.join() !== SPOTS.map((s) => s.id).join()) {
    throw new Error('Fixture spots do not match the prototype catalog');
  }

  const nt = fixture.times.length;
  const n = SPOTS.length;
  const sw = { n, v: packAll(fixture, SPOT_WIND_SERIES) };
  D = {
    nt,
    sm: { n, v: packAll(fixture, SPOT_MARINE_SERIES) },
    sw,
    isDay: Uint8Array.from({ length: nt }, (_, t) => (sw.v.is_day[t * n] > 0.5 ? 1 : 0)),
    scores: new Float32Array(n * nt),
  };
  // The prototype's `prepare` scoring loop and `renderList` ranking.
  for (let p = 0; p < n; p++)
    for (let t = 0; t < nt; t++) D.scores[p * nt + t] = spotCond(p, t).score;
  const rankings = fixture.times.map((_, t) =>
    SPOTS.map((s, p) => p)
      .sort((a, b) => scoreAt(b, t) - scoreAt(a, t))
      .map((p) => SPOTS[p].id),
  );

  const expected = {
    fixtureRecordedAt: fixture.recordedAt,
    spots: SPOTS.map((s, p) => ({
      id: s.id,
      score: fixture.times.map((_, t) => spotCond(p, t).score),
      surf: fixture.times.map((_, t) => spotCond(p, t).surf),
    })),
    rankings,
  };

  const options = await resolveConfig(OUTPUT_PATH);
  await writeFile(
    OUTPUT_PATH,
    await format(JSON.stringify(expected), { ...options, filepath: OUTPUT_PATH }),
  );
  console.log(`Wrote expected scores for ${n} spots × ${nt} hours to ${OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
