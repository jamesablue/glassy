import { clamp } from '../math/clamp';
import type {
  AssessedWaveComponent,
  Conditions,
  Spot,
  SpotHourSample,
  WaveComponent,
  WaveComponentKind,
  WindKind,
} from '../models';
import { FEET_PER_METER, KMH_PER_KNOT, KNOTS_PER_METER_PER_SECOND } from '../units/conversions';
import { angularDifference } from './angles';
import { exposure } from './exposure';
import { periodFactor } from './period-factor';
import { CURRENT_PENALTY, SURF_PENALTY, WIND_PENALTY } from './penalty-tables';
import { piecewise } from './piecewise';

export const MAX_SCORE = 10;

/** Wind within this many degrees of straight onshore counts as onshore (and likewise offshore). */
const ONSHORE_SECTOR = 45;

/** Share of wind strength shelter can take away: a fully sheltered spot feels 55% of the wind. */
const SHELTER_WIND_REDUCTION = 0.45;

/**
 * Scores snorkel conditions at a spot for one forecast hour, starting from 10 and taking off
 * points for surf, wind and current.
 *
 * - **Surf**: each wave train is scaled by how much of it reaches the spot (`exposure`) and by how
 *   much its period makes it grow when it breaks (`periodFactor`). The trains are combined as the
 *   root of the sum of squares, since wave energy adds, then reduced by the spot's shelter.
 * - **Wind**: onshore wind hurts most. Speed is weighted from 1 (straight onshore) down to 0.2
 *   (straight offshore) and reduced by up to 45% for shelter. Missing wind costs nothing.
 * - **Current**: penalised from half a knot up, reduced by shelter. Missing current counts as none.
 *
 * The score is clamped to 0–10.
 */
export function assessConditions(spot: Spot, sample: SpotHourSample): Conditions {
  const components = [
    assessWaveComponent('primarySwell', sample.primarySwell, spot),
    assessWaveComponent('secondarySwell', sample.secondarySwell, spot),
    assessWaveComponent('windWaves', sample.windWaves, spot),
  ] as const;
  const surf = combinedSurf(components) * (1 - spot.shelter);

  const relativeWindAngle = angularDifference(sample.windDirection, spot.facing);
  const effectiveWind = effectiveWindKnots(sample.windSpeed, relativeWindAngle, spot.shelter);
  const currentKnots =
    (Number.isFinite(sample.currentSpeed) ? sample.currentSpeed : 0) / KMH_PER_KNOT;

  const surfPenalty = piecewise(SURF_PENALTY, surf * FEET_PER_METER);
  const windPenalty = Number.isFinite(effectiveWind) ? piecewise(WIND_PENALTY, effectiveWind) : 0;
  const currentPenalty = piecewise(CURRENT_PENALTY, currentKnots) * (1 - spot.shelter);

  return {
    score: clamp(MAX_SCORE - surfPenalty - windPenalty - currentPenalty, 0, MAX_SCORE),
    surf,
    components,
    relativeWindAngle,
    windKind: windKind(relativeWindAngle),
    effectiveWind,
    currentKnots,
    sample,
  };
}

function assessWaveComponent(
  kind: WaveComponentKind,
  component: WaveComponent,
  spot: Spot,
): AssessedWaveComponent {
  if (!Number.isFinite(component.height) || !Number.isFinite(component.direction)) {
    return { ...component, kind, available: false };
  }
  const share = exposure(component.direction, spot);
  return {
    ...component,
    kind,
    available: true,
    exposure: share,
    surf: component.height * share * periodFactor(component.period),
  };
}

/** Wave energy scales with height squared, so trains add as the root of the sum of squares. */
function combinedSurf(components: readonly AssessedWaveComponent[]): number {
  let energy = 0;
  for (const component of components) {
    if (component.available) energy += component.surf * component.surf;
  }
  return Math.sqrt(energy);
}

/**
 * Wind speed in knots, weighted by direction and shelter. Onshore wind piles chop onto the spot;
 * offshore wind blows over the land first and mostly flattens the water close in.
 */
function effectiveWindKnots(windSpeed: number, relativeAngle: number, shelter: number): number {
  const directionWeight = 0.6 + 0.4 * Math.cos((relativeAngle * Math.PI) / 180);
  return (
    windSpeed *
    KNOTS_PER_METER_PER_SECOND *
    directionWeight *
    (1 - SHELTER_WIND_REDUCTION * shelter)
  );
}

function windKind(relativeAngle: number): WindKind {
  if (relativeAngle < ONSHORE_SECTOR) return 'onshore';
  if (relativeAngle > 180 - ONSHORE_SECTOR) return 'offshore';
  return 'cross-shore';
}
