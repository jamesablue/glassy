import type { HeightUnit, PointSample, UnitSettings } from '../../../domain/models';
import { timeLabel } from '../../../domain/time';
import {
  compassPoint,
  formatDepth,
  formatHeight,
  formatPeriod,
  formatSpeed,
  NO_VALUE,
  SPEED_LABELS,
  travelBearing,
} from '../../../domain/units';
import type { ElevationReading, PointReading } from '../../../state';

/** One line of the point readout. */
export interface ReadoutRow {
  readonly label: string;
  readonly value: string;
  /** Compass bearing the value travels towards, for its arrow. Absent for values with no direction. */
  readonly heading?: number;
  /** Why the value is missing, shown as a tooltip and read out after it. */
  readonly note?: string;
}

/** What the depth row says when NOAA has no elevation for the point. */
export const NO_DEPTH_DATA = 'NOAA has no depth data for this point';
/** What the depth row says when the lookup failed. */
export const DEPTH_LOOKUP_FAILED = 'Couldn’t get the depth from NOAA. Tap the map again to retry.';

/** Coordinates to four decimals (about 11 m) and the hour shown, for example "21.2690°, -157.6936° · Sun 3 PM". */
export function readoutTitle({ point, time }: PointReading): string {
  const where = `${point.lat.toFixed(4)}°, ${point.lon.toFixed(4)}°`;
  return time === undefined ? where : `${where} · ${timeLabel(time)}`;
}

/** Wind, waves and swell at the point (or why there are none), then the depth or land height. */
export function readoutRows(reading: PointReading, units: UnitSettings): ReadoutRow[] {
  const { forecast } = reading;
  const note = depthNote(reading.elevation);
  const depth: ReadoutRow = {
    label: 'Depth',
    value: elevationText(reading.elevation, units.height),
    ...(note ? { note } : {}),
  };
  switch (forecast.status) {
    case 'ready':
      return [...forecastRows(forecast.sample, units), depth];
    case 'outside':
      return [{ label: 'Forecast', value: 'outside area' }, depth];
    case 'unavailable':
      return [{ label: 'Forecast', value: 'unavailable' }, depth];
    case 'loading':
      return [{ label: 'Forecast', value: 'loading…' }, depth];
  }
}

/** Depth for water ("28 ft"), height for land ("land · 207 ft elev."), or why there is neither. */
export function elevationText(elevation: ElevationReading, unit: HeightUnit): string {
  switch (elevation.status) {
    case 'loading':
      return 'loading…';
    case 'no-data':
    case 'error':
      return NO_VALUE;
    case 'ready':
      return elevation.meters < 0
        ? formatDepth(-elevation.meters, unit)
        : `land · ${formatDepth(elevation.meters, unit)} elev.`;
  }
}

/** Why there is no depth to show, or `undefined` when there is one (or it is on its way). */
export function depthNote(elevation: ElevationReading): string | undefined {
  switch (elevation.status) {
    case 'no-data':
      return NO_DEPTH_DATA;
    case 'error':
      return DEPTH_LOOKUP_FAILED;
    default:
      return undefined;
  }
}

function forecastRows(sample: PointSample, units: UnitSettings): ReadoutRow[] {
  const speed = formatSpeed(sample.windSpeed, units.speed);
  return [
    withHeading(
      'Wind',
      `${speed} ${SPEED_LABELS[units.speed]} ${compassPoint(sample.windDirection) ?? ''}`.trim(),
      sample.windDirection,
      [sample.windSpeed],
    ),
    withHeading(
      'Waves',
      waveText(sample.waveHeight, sample.wavePeriod, units.height),
      sample.waveDirection,
      [sample.waveHeight, sample.wavePeriod],
    ),
    withHeading(
      'Swell',
      waveText(sample.swellHeight, sample.swellPeriod, units.height),
      sample.swellDirection,
      [sample.swellHeight, sample.swellPeriod],
    ),
  ];
}

function waveText(height: number, period: number, unit: HeightUnit): string {
  return `${formatHeight(height, unit)} ${unit} · ${formatPeriod(period)}s`;
}

/**
 * A row with an arrow pointing the way the value travels (forecasts give where it comes from), or
 * a dash when the forecast has no data for it.
 */
function withHeading(
  label: string,
  value: string,
  from: number,
  required: readonly number[],
): ReadoutRow {
  if (!required.every(Number.isFinite)) return { label, value: NO_VALUE };
  return Number.isFinite(from) ? { label, value, heading: travelBearing(from) } : { label, value };
}
