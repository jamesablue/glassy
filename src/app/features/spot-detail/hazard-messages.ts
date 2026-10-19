import type { Conditions, HeightUnit } from '../../domain/models';
import type { Hazard } from '../../domain/scoring';
import { surfText } from '../../domain/units';

/** What to tell a snorkeler about a hazard, in the conditions at hand. */
export function hazardMessage(hazard: Hazard, conditions: Conditions, unit: HeightUnit): string {
  switch (hazard) {
    case 'big-surf':
      return `Surf around ${surfText(conditions.surf, unit)} here. Getting in and out over the reef can be dangerous.`;
    case 'strong-wind':
      return 'Strong onshore wind: expect chop and poor visibility.';
    case 'strong-current':
      return `Current near ${conditions.currentKnots.toFixed(1)} kt offshore. Stay close to shore.`;
  }
}
