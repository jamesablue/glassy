import { createHash } from 'node:crypto';
import type { Spot } from '@glassy/shared';
import { OFFSHORE_DISTANCE_KM } from '../../backend/src/geo/offshore-point';
import type { Beach } from './beaches';
import type { OmrBeach } from './omr';

/** Spot geometry a settings set can override for one beach. */
export type Geometry = Partial<Pick<Spot, 'facing' | 'window' | 'shelter'>>;

/**
 * What a backtest run scores with, other than the scoring code itself. To compare a change to the
 * code (for example a new `exposure()`), run the script on both branches and compare the reports;
 * each report prints the fingerprint of the settings it used.
 */
export interface ScoringSettings {
  readonly name: string;
  readonly label: string;
  /** How far out to sea marine values are read for each beach, km (see `offshorePoint`). */
  readonly offshoreDistanceKm: number;
  readonly geometry: Partial<Readonly<Record<OmrBeach, Geometry>>>;
}

/** Today's catalog geometry, read where the ingest reads it. */
export const BASELINE: ScoringSettings = {
  name: 'baseline',
  label: 'Today',
  offshoreDistanceKm: OFFSHORE_DISTANCE_KM,
  geometry: {},
};

/** Settings the script can compare with the baseline, by name (`--candidate <name>`). */
export const CANDIDATES: readonly ScoringSettings[] = [
  {
    // The direction #55 picked ("trust the model"): read the model close to shore, where it has
    // already bent and blocked the swell around the island.
    name: 'near-shore',
    label: 'Near shore (1 km)',
    offshoreDistanceKm: 1,
    geometry: {},
  },
];

/** The beach's spot with the settings' geometry applied. */
export function spotFor(beach: Beach, settings: ScoringSettings): Spot {
  return { ...beach.spot, ...settings.geometry[beach.omr] };
}

/** A short hash of the settings and the beach geometry they produce, to match two runs. */
export function fingerprint(settings: ScoringSettings, beaches: readonly Beach[]): string {
  const spots = beaches.map((beach) => {
    const spot = spotFor(beach, settings);
    return [spot.id, spot.lat, spot.lon, spot.facing, spot.window ?? null, spot.shelter];
  });
  return createHash('sha256')
    .update(JSON.stringify([settings.offshoreDistanceKm, spots]))
    .digest('hex')
    .slice(0, 8);
}
