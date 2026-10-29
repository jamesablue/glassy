import type { LatLon } from '@glassy/shared';
import type { Row } from './analysis';
import type { Beach } from './beaches';
import { metrics, SECTORS, TOO_LOW_FT, type Metrics } from './metrics';
import type { SampleSeries } from './open-meteo';
import { spotFor, type ScoringSettings } from './settings';

/** Groups with fewer readings than this are marked as thin. */
const THIN_READINGS = 20;

/** One settings set's run. */
export interface Run {
  readonly settings: ScoringSettings;
  readonly fingerprint: string;
  readonly points: readonly LatLon[];
  readonly series: readonly SampleSeries[];
  /** Scored readings, only those every run could score, in the same order across runs. */
  readonly rows: readonly Row[];
}

export interface ReportInput {
  readonly fetchedAt: string;
  readonly start: number;
  readonly end: number;
  readonly days: number;
  readonly beaches: readonly Beach[];
  /** Readings the archive had in the period, before matching them to model hours. */
  readonly readingCount: number;
  readonly baseline: Run;
  readonly candidate: Run;
}

const feet = (value: number): string => (Number.isFinite(value) ? value.toFixed(2) : '–');
const signed = (value: number): string => {
  if (!Number.isFinite(value)) return '–';
  const text = Math.abs(value).toFixed(2);
  return Number(text) === 0 ? text : `${value > 0 ? '+' : '−'}${text}`;
};
const percent = (share: number): string =>
  Number.isFinite(share) ? `${Math.round(share * 100)}%` : '–';
const position = (point: LatLon): string => `${point.lat.toFixed(3)}, ${point.lon.toFixed(3)}`;
const isoDay = (time: number): string => new Date(time * 1000).toISOString().slice(0, 10);
const hst = (time: number): string =>
  new Date((time - 10 * 3600) * 1000).toISOString().slice(0, 16).replace('T', ' ') + ' HST';

function table(header: readonly string[], body: readonly (readonly string[])[]): string {
  const line = (cells: readonly string[]): string => `| ${cells.join(' | ')} |`;
  return [line(header), line(header.map(() => '---')), ...body.map(line)].join('\n');
}

interface Group {
  readonly label: string;
  readonly pick: (row: Row) => boolean;
}

const thin = (label: string, n: number): string => {
  if (n === 0) return `${label} (no readings)`;
  return n < THIN_READINGS ? `${label} (thin)` : label;
};

function beachGroups(beaches: readonly Beach[]): Group[] {
  return [
    ...beaches.map((beach) => ({
      label: `${beach.spot.name}${beach.kind === 'test' ? ' (test)' : ''}`,
      pick: (row: Row) => row.beach.omr === beach.omr,
    })),
    { label: '**Catalog spots**', pick: (row: Row) => row.beach.kind === 'catalog' },
    { label: '**All beaches**', pick: () => true },
  ];
}

const sectorGroups: Group[] = SECTORS.map((sector) => ({
  label: sector,
  pick: (row: Row) => row.sector === sector,
}));

const metricCells = (m: Metrics): string[] => [
  percent(m.overlap),
  feet(m.mae),
  signed(m.bias),
  percent(m.tooLow),
];

/** One run's metrics, one row per group. */
function single(groups: readonly Group[], rows: readonly Row[]): string {
  return table(
    ['', 'Readings', 'Overlap', 'MAE (ft)', 'Bias (ft)', `> ${TOO_LOW_FT} ft low`],
    groups.map((group) => {
      const m = metrics(rows.filter(group.pick));
      return [thin(group.label, m.n), String(m.n), ...metricCells(m)];
    }),
  );
}

/** Two runs side by side, one row per group. */
function compare(groups: readonly Group[], input: ReportInput): string {
  const a = input.baseline;
  const b = input.candidate;
  const both = (metric: string): string[] => [`${metric} A`, `${metric} B`];
  return table(
    [
      '',
      'Readings',
      ...both('Overlap'),
      ...both('MAE'),
      ...both('Bias'),
      ...both(`> ${TOO_LOW_FT} ft low`),
    ],
    groups.map((group) => {
      const ma = metrics(a.rows.filter(group.pick));
      const mb = metrics(b.rows.filter(group.pick));
      return [
        thin(group.label, ma.n),
        String(ma.n),
        percent(ma.overlap),
        percent(mb.overlap),
        feet(ma.mae),
        feet(mb.mae),
        signed(ma.bias),
        signed(mb.bias),
        percent(ma.tooLow),
        percent(mb.tooLow),
      ];
    }),
  );
}

function beachTable(input: ReportInput): string {
  return table(
    ['Beach', 'Lifeguard name', 'Kind', 'Position', 'Facing', 'Window', 'Shelter', 'Model cell'],
    input.beaches.map((beach, index) => {
      const spot = spotFor(beach, input.baseline.settings);
      const cell = input.baseline.series[index]?.cell;
      return [
        spot.name,
        beach.omr,
        beach.kind === 'catalog' ? `catalog (\`${spot.id}\`)` : 'test',
        position(spot),
        `${spot.facing}°`,
        spot.window === undefined ? 'default' : `${spot.window}°`,
        spot.shelter.toFixed(2),
        cell ? position(cell) : '–',
      ];
    }),
  );
}

function settingsTable(input: ReportInput): string {
  return table(
    ['Settings', 'Name', 'Reads marine values', 'Geometry overrides', 'Fingerprint'],
    [input.baseline, input.candidate].map((run) => [
      run.settings.label,
      `\`${run.settings.name}\``,
      `${run.settings.offshoreDistanceKm} km out along facing`,
      Object.keys(run.settings.geometry).length === 0
        ? 'none'
        : Object.entries(run.settings.geometry)
            .map(([beach, geometry]) => `${beach}: ${JSON.stringify(geometry)}`)
            .join('; '),
      `\`${run.fingerprint}\``,
    ]),
  );
}

/**
 * The day #56, #57 and #58 cite. The lifeguard report carrying it was issued at 01:15 UTC on
 * Oct 29, but the reading was taken on Oct 28, Hawaii time.
 */
const EXAMPLE_DAY = '2026-10-28';

/** Every reading at the example beach on the example day, under both settings. */
function exampleRows(input: ReportInput): string | undefined {
  const day = EXAMPLE_DAY;
  const pick = (row: Row): boolean =>
    row.beach.omr === 'MAKAHA' && isoDay(row.observation.time - 10 * 3600) === day;
  const a = input.baseline.rows.filter(pick);
  const b = input.candidate.rows.filter(pick);
  if (a.length === 0) return undefined;
  const range = (row: Row | undefined): string =>
    row ? `${feet(row.estimate)} ft → ${row.rangeLow}–${row.rangeHigh}` : '–';
  return table(
    [
      'Taken',
      'Lifeguards',
      `A: ${input.baseline.settings.label}`,
      `B: ${input.candidate.settings.label}`,
    ],
    a.map((row, index) => [
      hst(row.observation.time),
      `${row.low}–${row.high} ft`,
      range(row),
      range(b[index]),
    ]),
  );
}

function summary(input: ReportInput): string {
  const a = metrics(input.baseline.rows);
  const b = metrics(input.candidate.rows);
  const describe = (m: Metrics): string =>
    `its range overlaps the lifeguards' ${percent(m.overlap)} of the time, the mean absolute ` +
    `error is ${feet(m.mae)} ft, the bias is ${signed(m.bias)} ft, and ${percent(m.tooLow)} of ` +
    `readings are more than ${TOO_LOW_FT} ft too low`;
  const better = (name: string, x: number, y: number, lowerIsBetter: boolean): string => {
    if (!Number.isFinite(x) || !Number.isFinite(y) || x === y) return `the same ${name}`;
    return (lowerIsBetter ? y < x : y > x) ? `a better ${name}` : `a worse ${name}`;
  };
  return (
    `With today's settings, over all ${a.n} readings, ${describe(a)}. ` +
    `${input.candidate.settings.label}: ${describe(b)}. Against today, that is ` +
    `${better('overlap', a.overlap, b.overlap, false)}, ${better('error', a.mae, b.mae, true)} ` +
    `and ${better('share too low', a.tooLow, b.tooLow, true)}.`
  );
}

/** A note on beaches with no readings in the period, or nothing when every beach has some. */
function missing(input: ReportInput): string {
  const empty = input.beaches.filter(
    (beach) => !input.baseline.rows.some((row) => row.beach.omr === beach.omr),
  );
  if (empty.length === 0) return '';
  const names = empty.map((beach) => beach.spot.name).join(' and ');
  return (
    `**${names} had no readings in this period.** Their rows in the lifeguard report have been ` +
    'blank since 2025, so they have no numbers below. The report still lists them, so they reappear ' +
    'here if lifeguards start reporting them again.'
  );
}

/** The backtest report, as Markdown (formatted with Prettier by the caller). */
export function renderReport(input: ReportInput): string {
  const groups = beachGroups(input.beaches);
  const example = exampleRows(input);
  const matched = input.baseline.rows.length;

  return `# Lifeguard surf backtest

Generated by \`npm run backtest:lifeguards\` (#58) from data downloaded at ${input.fetchedAt}. It covers ${input.days} days, ${isoDay(input.start)} to ${isoDay(input.end)}: ${input.readingCount} Oahu lifeguard readings, of which ${matched} could be matched to a model hour and scored. Rerunning it reuses the downloads cached in \`.local/lifeguard-backtest/\`; \`--refresh\` downloads them again.

${missing(input)}

## Summary

${summary(input)}

Groups with fewer than ${THIN_READINGS} readings are marked "thin": read them as anecdotes. In the tables comparing two settings, A is ${input.baseline.settings.label} and B is ${input.candidate.settings.label}.

## What is compared

- **Lifeguards:** NWS Honolulu's daily Surf Observations (product \`OMRHFO\`), from the
  [Iowa Environmental Mesonet archive](https://mesonet.agron.iastate.edu/wx/afos/). The report
  says its full-face surf observations are taken by county lifeguards and cooperative observers,
  and that they are not quality controlled. Heights are ranges in feet. "FLAT" and "0" count as
  0–0 ft, and a "+" (bigger sets now and then) is dropped. A row with no time takes the time most
  other Oahu rows in its issue used.
- **Glassy:** Open-Meteo's past marine values (default wave model, the ingest's query plus
  \`past_days\`) at each beach's sampling point, scored with the app's own \`assessConditions\`
  at the model hour nearest each reading. The estimate is full-face breaking height in feet, and
  the range is the one the app displays (\`feetRange\`).
- **Caveat:** past model values are close to an analysis, not forecasts issued days ahead, so
  this checks the surf formula and the spot geometry, not how accuracy drops with lead time.

Metrics:

- **Overlap:** Glassy's displayed range and the lifeguard range share at least one value.
- **MAE and bias:** Glassy's estimate minus the midpoint of the lifeguard range. A negative bias
  reads low.
- **> ${TOO_LOW_FT} ft low:** the estimate is more than ${TOO_LOW_FT} ft below the low end of the lifeguard range.
- **Direction:** Oahu lifeguard rows rarely give a swell direction, so readings are grouped by
  the direction of the model train that adds the most surf at the beach that hour.

## Settings

${settingsTable(input)}

The fingerprint hashes the sampling distance and every beach's position, facing, window and shelter.
To measure a change to the scoring code itself, run the script on \`main\` and on the branch and
compare the two reports; matching fingerprints mean only the code differs.

## Today's settings by beach

${single(groups, input.baseline.rows)}

## Today's settings by direction

${single(sectorGroups, input.baseline.rows)}

## ${input.baseline.settings.label} against ${input.candidate.settings.label}, by beach

${compare(groups, input)}

## ${input.baseline.settings.label} against ${input.candidate.settings.label}, by direction

${compare(sectorGroups, input)}

## The Mākaha example

#56, #57 and #58 cite a lifeguard reading of Mākaha at 1–2 ft, 10:49 AM, and date it
Oct 29, 2026. That is the UTC date of the report that carried it: the reading was taken on Oct 28,
Hawaii time. Surfline forecast 2–3 ft+, and the live app estimated about 1.2 ft, which displayed as "0–1"
because the range rounded its low end down. The range now always contains the estimate.

${example ?? 'The reading is outside this period.'}

The live app scored a forecast; this backtest scores the model's past values, which are close to an
analysis. Where they differ, the gap is forecast error, which this backtest doesn't measure.

## Beaches

${beachTable(input)}

Mākaha and Diamond Head are catalog spots, scored as the app scores them. The other five are
**test beaches**: scored like spots but never added to the catalog. Their facing and window are
estimated by hand until #57 measures them from coastline data, and their shelter is near zero
because lifeguards read the outer break. "Model cell" is the wave-model cell Open-Meteo used for
today's sampling point.
`;
}
