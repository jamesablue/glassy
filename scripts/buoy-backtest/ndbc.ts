/**
 * NDBC spectral wave summaries (`realtime2/<id>.spec`): the last 45 days of a buoy's significant
 * wave height, split into swell and wind waves. Format: https://www.ndbc.noaa.gov/faq/measdes.shtml
 */

export function specUrl(buoyId: string): string {
  return `https://www.ndbc.noaa.gov/data/realtime2/${buoyId}.spec`;
}

/** Whether `text` looks like a `.spec` file: it starts with the column header the parser expects. */
export function isSpecFile(text: string): boolean {
  return /^#YY\s+MM\s+DD\s+hh\s+mm\s+WVHT\s+SwH\s+SwP\s+WWH\s+WWP\s+SwD\b/.test(text);
}

/** One hour of buoy readings. A missing value (`MM`) is `NaN`. */
export interface BuoyHour {
  /** The hour the reading is closest to, Unix seconds (UTC). */
  readonly time: number;
  /** Significant wave height, all waves, m. */
  readonly waveHeight: number;
  /** Significant height of the swell part of the spectrum, m. */
  readonly swellHeight: number;
  /** Swell peak period, s. */
  readonly swellPeriod: number;
  /** Direction the swell comes from, degrees, to the nearest of 16 compass points. */
  readonly swellDirection: number;
}

const COMPASS_POINTS = [
  'N',
  'NNE',
  'NE',
  'ENE',
  'E',
  'ESE',
  'SE',
  'SSE',
  'S',
  'SSW',
  'SW',
  'WSW',
  'W',
  'WNW',
  'NW',
  'NNW',
] as const;

/** A 16-point compass direction in degrees, or `NaN` when it isn't one. */
export function compassToDegrees(point: string): number {
  const index = (COMPASS_POINTS as readonly string[]).indexOf(point);
  return index < 0 ? NaN : index * 22.5;
}

function numberOrNaN(field: string | undefined): number {
  if (field === undefined || field === 'MM') return NaN;
  const value = Number(field);
  return Number.isFinite(value) ? value : NaN;
}

/**
 * Parses a `.spec` file into one reading per UTC hour, oldest first. Buoys report every 30 minutes,
 * at different minutes past the hour, so each reading is assigned to the nearest hour and the one
 * closest to it is kept (the earlier one on a tie).
 */
export function parseSpec(text: string): BuoyHour[] {
  const closest = new Map<number, { offset: number; hour: BuoyHour }>();
  for (const line of text.split('\n')) {
    if (line.startsWith('#') || line.trim() === '') continue;
    const [yy, mo, dd, hh, mm, wvht, swh, swp, , , swd] = line.trim().split(/\s+/);
    const observed = Date.UTC(Number(yy), Number(mo) - 1, Number(dd), Number(hh), Number(mm));
    if (!Number.isFinite(observed)) continue;
    const time = Math.round(observed / 3_600_000) * 3600;
    const offset = Math.abs(observed / 1000 - time);
    const previous = closest.get(time);
    if (previous && previous.offset <= offset) continue;
    closest.set(time, {
      offset,
      hour: {
        time,
        waveHeight: numberOrNaN(wvht),
        swellHeight: numberOrNaN(swh),
        swellPeriod: numberOrNaN(swp),
        swellDirection: compassToDegrees(swd ?? ''),
      },
    });
  }
  return [...closest.values()].map((entry) => entry.hour).sort((a, b) => a.time - b.time);
}
