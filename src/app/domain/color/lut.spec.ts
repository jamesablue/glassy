import { buildLut, cssRgb, inkFor, LUT_SIZE } from './lut';
import { colorAt, PALETTES } from './palettes';

describe('buildLut', () => {
  const lut = buildLut(PALETTES.waves);
  const entry = (index: number): number[] => Array.from(lut.subarray(index * 3, index * 3 + 3));

  it(`holds ${LUT_SIZE} RGB entries by default`, () => {
    expect(lut).toBeInstanceOf(Uint8ClampedArray);
    expect(lut).toHaveLength(LUT_SIZE * 3);
  });

  it('spans the palette from 0 to its max', () => {
    expect(entry(0)).toEqual([...colorAt(PALETTES.waves, 0)]);
    expect(entry(LUT_SIZE - 1)).toEqual([...colorAt(PALETTES.waves, PALETTES.waves.max)]);
  });

  it('samples evenly in between', () => {
    const index = 100;
    const value = (index / (LUT_SIZE - 1)) * PALETTES.waves.max;
    expect(entry(index)).toEqual([...colorAt(PALETTES.waves, value)]);
  });

  it('accepts a custom size', () => {
    const tiny = buildLut(PALETTES.period, 2);
    expect(Array.from(tiny)).toEqual([
      ...colorAt(PALETTES.period, 0),
      ...colorAt(PALETTES.period, 22),
    ]);
  });
});

describe('cssRgb', () => {
  it('formats a CSS rgb() colour', () => {
    expect(cssRgb([12, 34, 255])).toBe('rgb(12,34,255)');
  });
});

describe('inkFor', () => {
  it('uses dark text on light backgrounds', () => {
    expect(inkFor([255, 255, 255])).toBe('dark');
    expect(inkFor([255, 255, 0])).toBe('dark');
    expect(inkFor([166, 166, 166])).toBe('dark');
  });

  it('uses light text on dark backgrounds', () => {
    expect(inkFor([0, 0, 0])).toBe('light');
    expect(inkFor([164, 164, 164])).toBe('light');
  });

  it('weights green far above blue', () => {
    expect(inkFor([0, 255, 0])).toBe('light');
    expect(inkFor([80, 255, 80])).toBe('dark');
    expect(inkFor([80, 80, 255])).toBe('light');
  });
});
