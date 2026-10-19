import type { Rating } from '../models';

const HAZARDOUS = {
  label: 'Hazardous',
  min: -Infinity,
  color: '#f87171',
} as const satisfies Rating;

/** Score bands from best to worst. */
export const RATINGS = [
  { label: 'Excellent', min: 8, color: '#34d399' },
  { label: 'Good', min: 6.5, color: '#a3e635' },
  { label: 'Fair', min: 5, color: '#facc15' },
  { label: 'Poor', min: 3, color: '#fb923c' },
  HAZARDOUS,
] as const satisfies readonly Rating[];

/** The band a score falls in. A missing (`NaN`) score is treated as hazardous. */
export function rateScore(score: number): Rating {
  return RATINGS.find((rating) => score >= rating.min) ?? HAZARDOUS;
}
