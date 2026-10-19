import type { Spot } from '../models';
import { testSpot } from '../../../testing/domain-builders';
import { DEFAULT_SWELL_WINDOW, exposure } from './exposure';

describe('exposure', () => {
  const northFacing = testSpot({ facing: 0, window: 80 });

  it('lets head-on swell arrive in full', () => {
    expect(exposure(0, northFacing)).toBe(1);
  });

  it('tapers along a cosine inside the window', () => {
    expect(exposure(40, northFacing)).toBeCloseTo(0.25 + 0.75 * Math.cos(Math.PI / 4), 12);
    expect(exposure(-40, northFacing)).toBeCloseTo(exposure(40, northFacing), 12);
  });

  it('lets a quarter through at the window edge', () => {
    expect(exposure(80, northFacing)).toBeCloseTo(0.25, 12);
    expect(exposure(280, northFacing)).toBeCloseTo(0.25, 12);
  });

  it('fades linearly to nothing across the 45° wrap zone', () => {
    expect(exposure(80 + 22.5, northFacing)).toBeCloseTo(0.125, 12);
    expect(exposure(80 + 45, northFacing)).toBe(0);
  });

  it('blocks swell from beyond the wrap zone and from behind', () => {
    expect(exposure(126, northFacing)).toBe(0);
    expect(exposure(180, northFacing)).toBe(0);
  });

  it('never increases as swell moves off-axis', () => {
    let previous = Infinity;
    for (let offAxis = 0; offAxis <= 180; offAxis += 2.5) {
      const share = exposure(offAxis, northFacing);
      expect(share).toBeLessThanOrEqual(previous);
      previous = share;
    }
  });

  it('measures the angle across north', () => {
    const facing350 = testSpot({ facing: 350, window: 80 });
    expect(exposure(10, facing350)).toBeCloseTo(exposure(20, northFacing), 12);
  });

  it('uses the spot window', () => {
    const wide = testSpot({ facing: 0, window: 90 });
    expect(exposure(80, wide)).toBeCloseTo(0.25 + 0.75 * Math.cos((80 / 90) * (Math.PI / 2)), 12);
    expect(exposure(130, wide)).toBeCloseTo(0.25 * (1 - 40 / 45), 12);
  });

  it(`defaults the window to ${DEFAULT_SWELL_WINDOW}° when the spot has none`, () => {
    const noWindow: Spot = {
      id: 'no-window',
      name: 'No Window',
      region: 'North Shore',
      lat: 21.6,
      lon: -158.1,
      facing: 0,
      shelter: 0,
      level: 'Beginner',
      notes: '',
    };
    expect(exposure(DEFAULT_SWELL_WINDOW, noWindow)).toBeCloseTo(0.25, 12);
    expect(exposure(60, noWindow)).toBe(exposure(60, northFacing));
  });

  it('lets nothing through when the direction is missing', () => {
    expect(exposure(NaN, northFacing)).toBe(0);
  });
});
