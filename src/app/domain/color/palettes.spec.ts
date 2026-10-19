import type { Palette } from '../models';
import { colorAt, PALETTES } from './palettes';

describe('colorAt', () => {
  const ramp: Palette = {
    max: 2,
    stops: [
      [0, [0, 0, 0]],
      [1, [100, 200, 50]],
      [2, [200, 200, 250]],
    ],
  };

  it('returns the stop colour on a stop', () => {
    expect(colorAt(ramp, 0)).toEqual([0, 0, 0]);
    expect(colorAt(ramp, 1)).toEqual([100, 200, 50]);
    expect(colorAt(ramp, 2)).toEqual([200, 200, 250]);
  });

  it('interpolates each channel between stops and rounds it', () => {
    expect(colorAt(ramp, 0.5)).toEqual([50, 100, 25]);
    expect(colorAt(ramp, 1.25)).toEqual([125, 200, 100]);
    expect(colorAt(ramp, 0.333)).toEqual([33, 67, 17]);
  });

  it('holds the end colours outside the stops', () => {
    expect(colorAt(ramp, -3)).toEqual([0, 0, 0]);
    expect(colorAt(ramp, 99)).toEqual([200, 200, 250]);
  });

  it('colours the forecast palettes in their native units', () => {
    expect(colorAt(PALETTES.waves, 0.15)).toEqual([45, 65, 148]);
    expect(colorAt(PALETTES.wind, 0)).toEqual([98, 113, 183]);
    expect(colorAt(PALETTES.period, 22)).toEqual([160, 60, 170]);
  });
});

describe('PALETTES', () => {
  it.each(Object.entries(PALETTES))(
    '%s has ascending stops that end at its max',
    (_id, palette) => {
      const values = palette.stops.map(([value]) => value);
      expect(values).toEqual([...values].sort((a, b) => a - b));
      expect(new Set(values).size).toBe(values.length);
      expect(values[0]).toBe(0);
      expect(values.at(-1)).toBe(palette.max);
    },
  );

  it.each(Object.entries(PALETTES))('%s uses valid 8-bit channels', (_id, palette) => {
    for (const [, color] of palette.stops) {
      for (const channel of color) {
        expect(Number.isInteger(channel) && channel >= 0 && channel <= 255).toBe(true);
      }
    }
  });
});
