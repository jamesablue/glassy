import type { Conditions } from '../models';
import { FEET_PER_METER } from '../units/conversions';

/** A safety warning shown with a spot's conditions. */
export type Hazard = 'big-surf' | 'strong-wind' | 'strong-current';

/** Surf this high (feet) makes getting in and out over the reef dangerous. */
export const HAZARD_SURF_FEET = 3;
/** Effective wind this strong (knots) means chop and poor visibility. */
export const HAZARD_WIND_KNOTS = 18;
/** Current this strong (knots) can carry a swimmer offshore. */
export const HAZARD_CURRENT_KNOTS = 1;

/** The warnings that apply to a spot's conditions, in display order. */
export function hazardsFor(conditions: Conditions): readonly Hazard[] {
  const hazards: Hazard[] = [];
  if (conditions.surf * FEET_PER_METER >= HAZARD_SURF_FEET) hazards.push('big-surf');
  if (conditions.effectiveWind >= HAZARD_WIND_KNOTS) hazards.push('strong-wind');
  if (conditions.currentKnots >= HAZARD_CURRENT_KNOTS) hazards.push('strong-current');
  return hazards;
}
