import type { LatLon } from '@glassy/shared';
import { offshorePoint } from '../../backend/src/geo/offshore-point';
import { assessConditions } from '../../src/app/domain/scoring/assess-conditions';
import { FEET_PER_METER } from '../../src/app/domain/units/conversions';
import { feetRange } from '../../src/app/domain/units/surf-range';
import type { Beach } from './beaches';
import { sectorOf, type Pair, type Sector } from './metrics';
import type { Observation } from './omr';
import type { SampleSeries } from './open-meteo';
import { spotFor, type ScoringSettings } from './settings';

/** One lifeguard reading scored with one settings set. */
export interface Row extends Pair {
  readonly beach: Beach;
  readonly observation: Observation;
  /** The model hour the reading was matched to, Unix seconds. */
  readonly hour: number;
  /**
   * Where the train that adds the most surf comes from. Oahu lifeguard rows rarely give a swell
   * direction, so the model's is used to group readings.
   */
  readonly sector: Sector;
}

/** Where marine values are read for each beach under `settings`, in `beaches` order. */
export function samplingPoints(
  beaches: readonly Beach[],
  settings: ScoringSettings,
): readonly LatLon[] {
  return beaches.map((beach) =>
    offshorePoint(spotFor(beach, settings), settings.offshoreDistanceKm),
  );
}

const HOUR_S = 3600;

/**
 * Scores every reading with the real scoring code at the model hour nearest it. Readings with no
 * model hour, or no wave train the model has data for, are left out.
 */
export function scoreReadings(
  observations: readonly Observation[],
  beaches: readonly Beach[],
  series: readonly SampleSeries[],
  settings: ScoringSettings,
): Row[] {
  return observations.flatMap((observation) => {
    const index = beaches.findIndex((beach) => beach.omr === observation.beach);
    const beach = beaches[index];
    const hour = Math.round(observation.time / HOUR_S) * HOUR_S;
    const sample = series[index]?.hours.get(hour);
    if (!beach || !sample) return [];

    const conditions = assessConditions(spotFor(beach, settings), sample);
    const trains = conditions.components.filter((component) => component.available);
    if (trains.length === 0) return [];
    const strongest = trains.reduce((best, train) => (train.surf > best.surf ? train : best));

    const estimate = conditions.surf * FEET_PER_METER;
    const [rangeLow, rangeHigh] = feetRange(estimate) ?? [0, 0];
    return [
      {
        beach,
        observation,
        hour,
        sector: sectorOf(strongest.direction),
        low: observation.low,
        high: observation.high,
        estimate,
        rangeLow,
        rangeHigh,
      },
    ];
  });
}
