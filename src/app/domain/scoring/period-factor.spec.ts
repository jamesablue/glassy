import { DEFAULT_WAVE_PERIOD, periodFactor } from './period-factor';

describe('periodFactor', () => {
  it('grows linearly with period', () => {
    expect(periodFactor(8)).toBeCloseTo(1.02, 12);
    expect(periodFactor(10)).toBeCloseTo(1.15, 12);
    expect(periodFactor(14)).toBeCloseTo(1.41, 12);
  });

  it('holds short-period chop at 0.8', () => {
    expect(periodFactor(0)).toBe(0.8);
    expect(periodFactor(4)).toBe(0.8);
    expect(periodFactor(-3)).toBe(0.8);
  });

  it('holds long-period groundswell at 1.7', () => {
    expect(periodFactor(20)).toBe(1.7);
    expect(periodFactor(30)).toBe(1.7);
  });

  it('meets the clamps where the line crosses them', () => {
    expect(periodFactor(0.3 / 0.065)).toBeCloseTo(0.8, 12);
    expect(periodFactor(1.2 / 0.065)).toBeCloseTo(1.7, 12);
  });

  it(`assumes ${DEFAULT_WAVE_PERIOD} s when the period is missing`, () => {
    expect(periodFactor(NaN)).toBe(periodFactor(DEFAULT_WAVE_PERIOD));
    expect(periodFactor(Infinity)).toBe(periodFactor(DEFAULT_WAVE_PERIOD));
  });
});
