/**
 * NWS Honolulu's daily Surf Observations (product OMR, `OMRHFO`): full-face surf heights taken by
 * county lifeguards and relayed to the NWS, not quality controlled. The Iowa Environmental Mesonet
 * archives every issue as plain text.
 */

/** The Oahu beaches the report lists, by the name it uses. */
export const OMR_BEACHES = [
  'DIAMOND HEAD',
  'SUNSET',
  'WAIKIKI',
  'SANDY BEACH',
  'MAKAPUU',
  'EHUKAI',
  'MAKAHA',
] as const;

export type OmrBeach = (typeof OMR_BEACHES)[number];

/** One lifeguard reading. */
export interface Observation {
  readonly beach: OmrBeach;
  /** When it was taken, Unix seconds. */
  readonly time: number;
  /** Full-face height range, ft. Flat is 0–0. */
  readonly low: number;
  readonly high: number;
  /** The row had no time of its own and took the time most other Oahu rows in its issue used. */
  readonly timeBorrowed: boolean;
}

/** Hawaii Standard Time is UTC−10 all year: Hawaii has no daylight saving time. */
const HST_OFFSET_S = -10 * 3600;

/** The Iowa Mesonet archive's text for `OMRHFO` issued from `start` to `end` (UTC dates, `end` exclusive). */
export function omrArchiveUrl(start: string, end: string): string {
  const params = new URLSearchParams({
    pil: 'OMRHFO',
    sdate: start,
    edate: end,
    fmt: 'text',
    limit: '9999',
  });
  return `https://mesonet.agron.iastate.edu/cgi-bin/afos/retrieve.py?${params}`;
}

/** An archive download holds at least one issue of the report. */
export function isOmrArchive(text: string): boolean {
  return /^OMRHFO\s*$/m.test(text) && /SURF OBSERVATIONS/.test(text);
}

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

/** The issue date from a line like "315 PM HST WED OCT 28 2026", as [year, month index, day]. */
function issueDate(product: string): [number, number, number] | undefined {
  const match = /^\d{3,4} [AP]M HST [A-Z]{3} ([A-Z]{3}) (\d{1,2}) (\d{4})\s*$/m.exec(product);
  if (!match) return undefined;
  const month = MONTHS.indexOf(match[1] ?? '');
  return month < 0 ? undefined : [Number(match[3]), month, Number(match[2])];
}

/** Seconds after local midnight for a time like "1049 AM", "1200 PM" (noon) or "1205 AM". */
export function secondsAfterMidnight(clock: string, meridiem: string): number {
  const padded = clock.padStart(4, '0');
  const hour = Number(padded.slice(0, 2)) % 12;
  const minute = Number(padded.slice(2));
  return ((meridiem === 'PM' ? hour + 12 : hour) * 60 + minute) * 60;
}

/** A height like "1-2", "2-4+", "3", "0" or "FLAT", as a range in ft. "+" (bigger sets) is dropped. */
export function parseHeight(text: string): [low: number, high: number] | undefined {
  if (text === 'FLAT') return [0, 0];
  const match = /^(\d+)(?:-(\d+))?\+?$/.exec(text);
  if (!match) return undefined;
  const low = Number(match[1]);
  const high = match[2] === undefined ? low : Number(match[2]);
  return high >= low ? [low, high] : undefined;
}

const ROW = new RegExp(
  `^(${OMR_BEACHES.join('|')})\\s+(?:(\\d{3,4}) ([AP]M)\\s+)?(FLAT|\\d+(?:-\\d+)?\\+?)(?=\\s|$)`,
);

/** The Oahu readings in one issue. Rows without a height are skipped. */
function parseProduct(product: string): Observation[] {
  const date = issueDate(product);
  const block = /^OAHU-\s*$([\s\S]*?)^\$\$/m.exec(product)?.[1];
  if (!date || block === undefined) return [];
  const midnight = Date.UTC(...date) / 1000 - HST_OFFSET_S;

  const rows = block.split('\n').flatMap((line) => {
    const match = ROW.exec(line.trimEnd());
    const height = match && parseHeight(match[4] ?? '');
    if (!match || !height) return [];
    const clock = match[2] && match[3] ? secondsAfterMidnight(match[2], match[3]) : undefined;
    return [{ beach: match[1] as OmrBeach, clock, height }];
  });

  // Most rows in an issue share one time. A row that lost its time gets the commonest one.
  const counts = new Map<number, number>();
  for (const row of rows) {
    if (row.clock !== undefined) counts.set(row.clock, (counts.get(row.clock) ?? 0) + 1);
  }
  const commonest = [...counts].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0];

  return rows.flatMap((row) => {
    const clock = row.clock ?? commonest;
    if (clock === undefined) return [];
    return [
      {
        beach: row.beach,
        time: midnight + clock,
        low: row.height[0],
        high: row.height[1],
        timeBorrowed: row.clock === undefined,
      },
    ];
  });
}

/**
 * Every Oahu reading in archive downloads, oldest first. A reading repeated in a corrected or
 * reissued report (same beach and time) is kept once, from the last issue that has it.
 */
export function parseOmr(texts: readonly string[]): Observation[] {
  const byKey = new Map<string, Observation>();
  for (const text of texts) {
    // The archive starts each issue with a start-of-heading byte (U+0001).
    for (const product of text.split('\u0001')) {
      for (const observation of parseProduct(product)) {
        byKey.set(`${observation.beach}@${observation.time}`, observation);
      }
    }
  }
  return [...byKey.values()].sort((a, b) => a.time - b.time || a.beach.localeCompare(b.beach));
}
