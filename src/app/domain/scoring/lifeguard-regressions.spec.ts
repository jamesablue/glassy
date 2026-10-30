import { calmSample } from '../../../testing/domain-builders';
import { OAHU_SPOTS } from '../spots/oahu.spots';
import { FEET_PER_METER } from '../units/conversions';
import { feetRange } from '../units/surf-range';
import { assessConditions } from './assess-conditions';

/**
 * Days where lifeguards reported the surf and Glassy's estimate was questioned (#56). The wave
 * trains are Open-Meteo's past marine values at the spot's sampling point, as the lifeguard backtest
 * (`npm run backtest:lifeguards`, #58) read them; each case names the lifeguard reading it checks.
 */
describe('surf estimates against lifeguard readings', () => {
  const spot = (id: string) => {
    const found = OAHU_SPOTS.find((candidate) => candidate.id === id);
    if (!found) throw new Error(`No spot ${id}`);
    return found;
  };

  it('Mākaha, Oct 29, 2026, 11 AM HST: overlaps the lifeguards’ 1–2 ft at 10:49 AM', () => {
    // Model hour 2026-10-29T21:00Z, nearest the 10:49 AM reading.
    const sample = calmSample({
      primarySwell: { height: 1.18, period: 11.7, direction: 183 },
      secondarySwell: { height: 0.76, period: 7.7, direction: 13 },
      windWaves: { height: 0.12, period: 1.7, direction: 89 },
    });

    const feet = assessConditions(spot('makaha'), sample).surf * FEET_PER_METER;
    const [low, high] = feetRange(feet) ?? [0, 0];

    expect(feet).toBeCloseTo(1.16, 2);
    expect(low).toBeLessThanOrEqual(2);
    expect(high).toBeGreaterThanOrEqual(1);
  });
});
