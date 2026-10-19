import { calmSample, testSpot } from '../../../testing/domain-builders';
import type { Conditions } from '../models';
import { assessConditions } from './assess-conditions';
import { hazardsFor } from './hazards';

describe('hazardsFor', () => {
  const calm = assessConditions(testSpot(), calmSample());
  const conditions = (changes: Partial<Conditions>): Conditions => ({ ...calm, ...changes });

  it('has no warnings for calm conditions', () => {
    expect(hazardsFor(calm)).toEqual([]);
  });

  it('warns about surf from 3 ft', () => {
    expect(hazardsFor(conditions({ surf: 0.95 }))).toEqual(['big-surf']);
    expect(hazardsFor(conditions({ surf: 0.9 }))).toEqual([]);
  });

  it('warns about effective wind from 18 kt', () => {
    expect(hazardsFor(conditions({ effectiveWind: 18 }))).toEqual(['strong-wind']);
    expect(hazardsFor(conditions({ effectiveWind: 17.9 }))).toEqual([]);
  });

  it('warns about current from 1 kt', () => {
    expect(hazardsFor(conditions({ currentKnots: 1 }))).toEqual(['strong-current']);
    expect(hazardsFor(conditions({ currentKnots: 0.99 }))).toEqual([]);
  });

  it('lists every warning that applies, in display order', () => {
    expect(hazardsFor(conditions({ surf: 2, effectiveWind: 25, currentKnots: 1.5 }))).toEqual([
      'big-surf',
      'strong-wind',
      'strong-current',
    ]);
  });

  it('does not warn about missing wind', () => {
    expect(hazardsFor(conditions({ effectiveWind: NaN }))).toEqual([]);
  });
});
