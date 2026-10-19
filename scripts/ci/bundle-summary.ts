/**
 * Turns the chunk tables `ng build` prints into Markdown, with the initial bundle budget from
 * angular.json, for the CI job summary. The sizes are the Angular CLI's own: raw bytes, which the
 * budgets are checked against, and its estimate of the compressed transfer size.
 *
 * Usage: `npm run build 2>&1 | tee build.log`, then
 * `tsx scripts/ci/bundle-summary.ts build.log >> "$GITHUB_STEP_SUMMARY"`
 */
import { existsSync, readFileSync } from 'node:fs';

const ROOT = new URL('../../', import.meta.url);

interface Table {
  readonly title: string;
  readonly rows: string[][];
  total?: string[];
}

interface Budget {
  readonly type: string;
  readonly maximumWarning?: string;
  readonly maximumError?: string;
}

// The CLI colours its output on a terminal; CI logs have none, but strip any just in case.
// eslint-disable-next-line no-control-regex
const ANSI = /\u001b\[[0-9;]*m/g;

/** The CLI's chunk tables: a header row ending in "chunk files", then one row per file. */
function parseTables(log: string): Table[] {
  const tables: Table[] = [];
  let current: Table | undefined;
  for (const line of log.replace(ANSI, '').split('\n')) {
    if (!line.includes('|')) {
      if (line.trim() !== '') current = undefined;
      continue;
    }
    const cells = line.split('|').map((cell) => cell.trim());
    const first = cells[0] ?? '';
    if (/chunk files$/i.test(first)) {
      current = { title: first, rows: [] };
      tables.push(current);
    } else if (current && first === '') {
      current.total = cells.slice(1);
    } else if (current) {
      current.rows.push(cells);
    }
  }
  return tables;
}

function initialBudget(): string | undefined {
  const angular = JSON.parse(readFileSync(new URL('angular.json', ROOT), 'utf8')) as {
    projects: Record<
      string,
      { architect?: { build?: { configurations?: Record<string, { budgets?: Budget[] }> } } }
    >;
  };
  const budgets = Object.values(angular.projects)[0]?.architect?.build?.configurations?.[
    'production'
  ]?.budgets;
  const initial = budgets?.find((budget) => budget.type === 'initial');
  return initial
    ? `warning above ${initial.maximumWarning ?? '–'}, error above ${initial.maximumError ?? '–'}`
    : undefined;
}

function main(): void {
  const file = process.argv[2] ?? 'build.log';
  console.log('### Bundle size (production build)\n');
  const tables = existsSync(file) ? parseTables(readFileSync(file, 'utf8')) : [];
  if (tables.length === 0) {
    console.log(`No chunk tables in \`${file}\`: the build did not finish.`);
    return;
  }

  const initial = tables.find((table) => /^initial/i.test(table.title))?.total;
  if (initial) {
    const [, raw, transfer] = initial;
    const budget = initialBudget();
    console.log(
      `Initial total: **${raw}** raw, **${transfer}** estimated transfer` +
        (budget ? ` (budget: ${budget}, raw).` : '.') +
        '\n',
    );
  }
  for (const table of tables) {
    console.log(`| ${table.title} | Name | Raw size | Estimated transfer |`);
    console.log('| --- | --- | ---: | ---: |');
    for (const [chunk, name, raw, transfer] of table.rows) {
      console.log(`| \`${chunk}\` | ${name === '-' ? '' : name} | ${raw} | ${transfer} |`);
    }
    if (table.total) {
      const [label, raw, transfer] = table.total;
      console.log(`| **${label}** | | **${raw}** | **${transfer}** |`);
    }
    console.log('');
  }
}

main();
