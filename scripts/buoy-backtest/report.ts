import type { LatLon } from '@glassy/shared';
import { METHODS, metricsByMethod, type BuoyData, type Method, type Row } from './analysis';
import { TODAY_DISTANCE_KM, UPSTREAM_DISTANCE_KM } from './buoys';
import { DECISION_RULE, SECTORS, UNDER_PREDICTION_M, type Decision, type Metrics } from './metrics';

/** Sectors with fewer hours than this are marked as thin. */
const THIN_SECTOR_HOURS = 24;

export interface SensitivityCase {
  readonly label: string;
  readonly b: Metrics;
  readonly decision: Decision;
}

export interface ReportInput {
  readonly fetchedAt: string;
  readonly start: number;
  readonly end: number;
  readonly buoys: readonly BuoyData[];
  /** Hours compared on swell height (`SwH`), the headline before the first run. */
  readonly swell: readonly Row[];
  /** Hours compared on total height (`WVHT`), the headline. */
  readonly total: readonly Row[];
  /** The rule applied to total height. */
  readonly decision: Decision;
  /** The rule applied to swell height, as first set. */
  readonly swellDecision: Decision;
  readonly sensitivity: readonly SensitivityCase[];
}

const meters = (value: number): string => (Number.isFinite(value) ? value.toFixed(2) : '–');
const signed = (value: number): string =>
  Number.isFinite(value) ? `${value >= 0 ? '+' : '−'}${Math.abs(value).toFixed(2)}` : '–';
const percent = (share: number): string =>
  Number.isFinite(share) ? `${Math.round(share * 100)}%` : '–';
const degrees = (value: number): string => (Number.isFinite(value) ? `${Math.round(value)}°` : '–');
const position = (point: LatLon): string => `${point.lat.toFixed(3)}, ${point.lon.toFixed(3)}`;
const isoHour = (time: number): string => new Date(time * 1000).toISOString().slice(0, 13) + ':00Z';
const mean = (values: readonly number[]): number =>
  values.reduce((sum, value) => sum + value, 0) / values.length;

function table(header: readonly string[], body: readonly (readonly string[])[]): string {
  const line = (cells: readonly string[]): string => `| ${cells.join(' | ')} |`;
  return [line(header), line(header.map(() => '---')), ...body.map(line)].join('\n');
}

const buoyLabel = (data: BuoyData): string => `${data.buoy.id} ${data.buoy.name}`;

/** One row per buoy and a pooled row, with `cells` of each method's metrics. */
function perBuoy(
  input: ReportInput,
  selected: readonly Row[],
  cells: (metrics: Record<Method, Metrics>) => string[],
): string[][] {
  const groups = [
    ...input.buoys.map((data) => ({
      label: buoyLabel(data),
      rows: selected.filter((row) => row.buoyId === data.buoy.id),
    })),
    { label: '**All buoys**', rows: selected },
  ];
  return groups.map((group) => {
    const byMethod = metricsByMethod(group.rows);
    return [group.label, String(group.rows.length), ...cells(byMethod)];
  });
}

const each = (format: (metrics: Metrics) => string) => (byMethod: Record<Method, Metrics>) =>
  METHODS.map((method) => format(byMethod[method]));

const errorCells = (byMethod: Record<Method, Metrics>): string[] => [
  ...each((m) => meters(m.mae))(byMethod),
  ...each((m) => signed(m.bias))(byMethod),
];

const decisionText = (decision: Decision): string =>
  `${decision.choice}${decision.tie ? ' (tie)' : ''}${decision.poor ? ', poor' : ''}`;

function recommendation(input: ReportInput, pooled: Record<Method, Metrics>): string {
  const { decision } = input;
  const a = `A ${meters(pooled.A.mae)} m`;
  const b = `B ${meters(pooled.B.mae)} m`;
  const verdict = decision.tie
    ? `On total wave height, A and B are within the tie margin (${a}, ${b}), so the rule picks **A**.`
    : `On total wave height, **${decision.choice}** has the lower error (${a}, ${b}).`;
  const quality = decision.poor
    ? `Its error is above the "both poor" limits, so the rule recommends evaluating the PacIOOS SWAN Oahu model before #56 picks either one.`
    : `Its error is inside the "both poor" limits, so #56 can go ahead with ${decision.choice}.`;
  const flips = input.sensitivity.filter(
    (entry) => entry.decision.choice !== decision.choice || entry.decision.poor !== decision.poor,
  );
  const robust =
    flips.length === 0
      ? 'The choice holds for every variation of the buoy geometry in the sensitivity table.'
      : `The choice changes for ${flips.map((entry) => entry.label).join(', ')} in the sensitivity table, so it depends on the hand-estimated geometry.`;
  return `${verdict} ${quality} ${robust}`;
}

/** Mean buoy and model heights per buoy, showing how each splits swell from wind waves. */
function splitRows(input: ReportInput): string[][] {
  return input.buoys.map((data) => {
    const of = (rows: readonly Row[]) => rows.filter((row) => row.buoyId === data.buoy.id);
    const swell = of(input.swell);
    const total = of(input.total);
    return [
      buoyLabel(data),
      meters(mean(swell.map((row) => row.pairs.A.observed))),
      meters(mean(total.map((row) => row.pairs.A.observed))),
      meters(mean(swell.map((row) => row.pairs.A.predicted))),
      meters(mean(total.map((row) => row.pairs.A.predicted))),
    ];
  });
}

/** The backtest report, as Markdown (formatted with Prettier by the caller). */
export function renderReport(input: ReportInput): string {
  const pooled = metricsByMethod(input.total);
  const pooledSwell = metricsByMethod(input.swell);
  const sectorRows = SECTORS.map((sector) => {
    const selected = input.total.filter((row) => row.sector === sector);
    const thin = selected.length < THIN_SECTOR_HOURS ? ' (thin)' : '';
    return [`${sector}${thin}`, String(selected.length), ...errorCells(metricsByMethod(selected))];
  });
  const methodHeaders = (metric: string): string[] =>
    METHODS.map((method) => `${metric} ${method}`);
  const errorHeaders = ['Hours', ...methodHeaders('MAE'), ...methodHeaders('Bias')];

  return `# Buoy swell backtest

Generated by \`npm run backtest:buoys\` (#55) from data downloaded at ${input.fetchedAt}. It covers
${isoHour(input.start)} to ${isoHour(input.end)}: ${input.total.length} buoy hours across four NOAA
buoys. Rerunning it reuses the downloads cached in \`.local/buoy-backtest/\`; \`--refresh\` downloads
them again.

## Recommendation

${recommendation(input, pooled)}

The rule: the headline number is the mean absolute error (MAE) of total wave height, pooled over
all four buoys. A and B tie when their MAEs differ by less than ${DECISION_RULE.tieRelative * 100}%
of the smaller one or by less than ${DECISION_RULE.tieAbsoluteM} m, and a tie goes to A. The winner
is poor when its MAE is above ${DECISION_RULE.poorMaeM} m or its bias is further from zero than
${DECISION_RULE.poorBiasM} m.

### The headline metric changed after the first run

The rule was set before the first run with **swell height** as the headline. On swell height the
rule gives **${decisionText(input.swellDecision)}** (A ${meters(pooledSwell.A.mae)} m, B
${meters(pooledSwell.B.mae)} m). That comparison turned out to measure how the buoys and the model
split swell from wind waves, not how much wave energy reaches the buoy:

${table(
  ['Buoy', 'Buoy swell', 'Buoy total', 'Model swell (A)', 'Model total (A)'],
  splitRows(input),
)}

The buoys count most of the trade-wind waves as wind waves, while the model counts them as swell.
So the model's swell reads high at every buoy even where its total height is right, and B's lower
swell error comes from \`exposure()\` cutting that extra swell, not from better blocking. Total
height doesn't depend on the split, so the headline was changed to total height. The thresholds
are unchanged. The swell-height tables are kept at the end.

## What is compared

Each method predicts the buoy's total height (\`WVHT\` in the NDBC \`.spec\` file) from Open-Meteo's
primary swell, secondary swell and wind waves, combined by energy as in
[the scoring model](scoring-model.md). No period factor and no shelter, since the buoys sit in deep
water where waves don't break.

- **A, trust the model:** the model at the buoy itself, with no exposure.
- **B, Glassy does the blocking:** the model ${UPSTREAM_DISTANCE_KM} km out along the buoy's facing,
  with each train scaled by \`exposure()\` for the buoy's facing and window.
- **Today (baseline):** what the ingest does for spots today: the model ${TODAY_DISTANCE_KM} km out,
  scaled by \`exposure()\`. Not part of the decision.

All methods use Open-Meteo's default wave model with \`cell_selection=sea\`, like the ingest, and are
scored on the same hours.

## Buoys

Facing and window are estimated by hand from the headlands that bound each buoy's view of the open
ocean. The model cell is the one Open-Meteo picked for each method's point.

${table(
  ['Buoy', 'Position', 'Facing', 'Window', 'Open-ocean arc', 'Cell A', 'Cell B', 'Cell today'],
  input.buoys.map((data) => [
    buoyLabel(data),
    position(data.buoy),
    degrees(data.buoy.facing),
    degrees(data.buoy.window),
    data.buoy.arc,
    ...METHODS.map((method) => position(data.model[method].cell)),
  ]),
)}

## Total height error

MAE and bias in meters. A negative bias reads low.

${table(['Buoy', ...errorHeaders], perBuoy(input, input.total, errorCells))}

## Under-prediction and direction

The share of hours each method reads total height more than ${UNDER_PREDICTION_M} m too low, and the
mean angle between the model's primary swell direction and the buoy's swell direction.

${table(
  ['Buoy', 'Hours', ...methodHeaders('Low'), ...methodHeaders('Direction')],
  perBuoy(input, input.total, (byMethod) => [
    ...each((m) => percent(m.underShare))(byMethod),
    ...each((m) => degrees(m.directionError))(byMethod),
  ]),
)}

## By swell direction

Total height at all buoys, grouped by the direction the buoy measured the swell from, in 45°
sectors. Sectors with fewer than ${THIN_SECTOR_HOURS} hours are marked thin.

${table(['Sector', ...errorHeaders], sectorRows)}

## Sensitivity to the buoy geometry

B again with each buoy's facing or window shifted, the model point unchanged.

${table(
  ['Variation', 'MAE B', 'Bias B', 'Decision'],
  input.sensitivity.map((entry) => [
    entry.label,
    meters(entry.b.mae),
    signed(entry.b.bias),
    decisionText(entry.decision),
  ]),
)}

## Swell height only

The first headline: the buoy's swell height (\`SwH\`) against the primary and secondary swell only.
See [why it was replaced](#the-headline-metric-changed-after-the-first-run).

${table(['Buoy', ...errorHeaders], perBuoy(input, input.swell, errorCells))}

## Caveats

- The buoys measure the waves coming in, not surf at the beach. #58 checks the final surf height
  against lifeguard reports, and should agree with this choice before #56 merges.
- Total height includes local wind waves, which the island doesn't block the way it blocks swell,
  and B and today scale them by \`exposure()\` too, as the scoring model does.
- NDBC gives the swell direction to the nearest of 16 compass points, so direction errors under
  about 11° are noise.
- Open-Meteo's past values are close to an analysis, not forecasts issued days ahead.
- Facing and window are hand estimates; the sensitivity table shows how much they matter.
`;
}
