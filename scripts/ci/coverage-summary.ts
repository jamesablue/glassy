/**
 * Prints the unit test coverage of each layer (`src/app/<layer>/`) as a Markdown table, next to the
 * floor `vitest-base.config.mts` holds it to. CI appends it to the job summary after
 * `npm run test:ci`, which writes `coverage/glassy/coverage-summary.json`.
 *
 * Usage: `tsx scripts/ci/coverage-summary.ts [coverage-summary.json] >> "$GITHUB_STEP_SUMMARY"`
 */
import { existsSync, readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const METRICS = ['statements', 'branches', 'functions', 'lines'] as const;
type Metric = (typeof METRICS)[number];

interface Count {
  readonly total: number;
  readonly covered: number;
}
type FileSummary = Readonly<Record<Metric, Count>>;
type Floors = Partial<Readonly<Record<Metric, number>>>;

/** Sums the counts of many files, as Vitest does for a threshold glob. */
function sum(files: readonly FileSummary[]): FileSummary {
  const totals = (metric: Metric): Count => ({
    total: files.reduce((total, file) => total + file[metric].total, 0),
    covered: files.reduce((covered, file) => covered + file[metric].covered, 0),
  });
  return {
    statements: totals('statements'),
    branches: totals('branches'),
    functions: totals('functions'),
    lines: totals('lines'),
  };
}

function percent({ total, covered }: Count): number {
  return total === 0 ? 100 : (covered / total) * 100;
}

/** "98.4%", with a cross when it is under the floor. */
function cell(count: Count, floor: number | undefined): string {
  const value = percent(count);
  const text = `${(Math.floor(value * 10) / 10).toFixed(1)}%`;
  return floor !== undefined && value < floor ? `❌ ${text}` : text;
}

/** The floors per layer, read from the threshold globs (`src/app/<layer>/**\/*.ts`). */
async function readFloors(): Promise<ReadonlyMap<string, Floors>> {
  const config = pathToFileURL(resolve(ROOT, 'vitest-base.config.mts')).href;
  const { default: settings } = (await import(config)) as {
    default: { test?: { coverage?: { thresholds?: Record<string, unknown> } } };
  };
  const floors = new Map<string, Floors>();
  for (const [glob, value] of Object.entries(settings.test?.coverage?.thresholds ?? {})) {
    const layer = /^src\/app\/([^/*]+)\/\*\*\/\*\.ts$/.exec(glob)?.[1];
    if (layer && typeof value === 'object' && value !== null) floors.set(layer, value as Floors);
  }
  return floors;
}

/** "95%" when the four floors agree, otherwise each one in metric order. */
function describeFloors(floors: Floors | undefined): string {
  if (!floors) return '–';
  const values = METRICS.map((metric) => floors[metric]);
  const first = values[0];
  return values.every((value) => value === first)
    ? `${first ?? '–'}%`
    : values.map((value) => (value === undefined ? '–' : `${value}%`)).join(' / ');
}

async function main(): Promise<void> {
  const file = resolve(ROOT, process.argv[2] ?? 'coverage/glassy/coverage-summary.json');
  console.log('### Unit test coverage\n');
  if (!existsSync(file)) {
    console.log(`No coverage report at \`${relative(ROOT, file)}\`: the tests did not finish.`);
    return;
  }

  const report = JSON.parse(readFileSync(file, 'utf8')) as Record<string, FileSummary>;
  const byLayer = new Map<string, FileSummary[]>();
  for (const [path, summary] of Object.entries(report)) {
    if (path === 'total') continue;
    const layer = /^src\/app\/([^/]+)\//.exec(relative(ROOT, path))?.[1] ?? '';
    byLayer.set(layer, [...(byLayer.get(layer) ?? []), summary]);
  }
  const floors = await readFloors();

  const rows = [...byLayer.keys()].sort().map((layer) => {
    const totals = sum(byLayer.get(layer) ?? []);
    const layerFloors = floors.get(layer);
    const cells = METRICS.map((metric) => cell(totals[metric], layerFloors?.[metric]));
    const name = layer === '' ? 'files in `src/app/`' : `\`${layer}/\``;
    return `| ${name} | ${cells.join(' | ')} | ${describeFloors(layerFloors)} |`;
  });
  const total = report['total'];
  if (total) {
    const cells = METRICS.map((metric) => `**${cell(total[metric], undefined)}**`);
    rows.push(`| **All files** | ${cells.join(' | ')} | |`);
  }

  console.log('| Layer | Statements | Branches | Functions | Lines | Floor |');
  console.log('| --- | ---: | ---: | ---: | ---: | ---: |');
  console.log(rows.join('\n'));
  console.log('\nFloors are set in `vitest-base.config.mts`; `npm run test:ci` fails below them.');
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
