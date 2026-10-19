import { buildLut, LUT_SIZE, PALETTES } from '../../domain/color';
import type { GridSpec } from '../../domain/models';
import { FIELD_ALPHA, lutIndex, paintField, type FieldPaint, type Pixels } from './paint-field';
import type { ViewportLookup } from './viewport-lookup';

describe('lutIndex', () => {
  it('maps 0 to the first entry and the palette max to the last', () => {
    expect(lutIndex(0, 10, 512)).toBe(0);
    expect(lutIndex(10, 10, 512)).toBe(511);
  });

  it('rounds to the nearest entry in between', () => {
    expect(lutIndex(5, 10, 512)).toBe(256);
    expect(lutIndex(1, 10, 11)).toBe(1);
    expect(lutIndex(1.04, 10, 11)).toBe(1);
  });

  it('holds the end entries for values outside the palette', () => {
    expect(lutIndex(-3, 10, 512)).toBe(0);
    expect(lutIndex(40, 10, 512)).toBe(511);
  });
});

describe('paintField', () => {
  const grid: GridSpec = { lat0: 21, lon0: -158, step: 1, rows: 2, cols: 2 };
  const lut = buildLut(PALETTES.waves);
  const field = (values: number[], hour = 0): FieldPaint => ({
    grid,
    values: Float32Array.from(values),
    hour,
    lut,
    max: PALETTES.waves.max,
  });
  const pixels = (width: number, height: number): Pixels => ({
    data: new Uint8ClampedArray(width * height * 4),
    width,
    height,
  });
  /** Every pixel inside the grid at row 0.5, column 0.5. */
  const inside = (width: number, height: number): ViewportLookup => ({
    rows: new Float32Array(height).fill(0.5),
    rowsOutside: new Float32Array(height),
    cols: new Float32Array(width).fill(0.5),
    colsOutside: new Float32Array(width),
  });
  const rgba = (image: Pixels, x: number, y: number): number[] => {
    const offset = (y * image.width + x) * 4;
    return Array.from(image.data.subarray(offset, offset + 4));
  };
  const lutColor = (value: number): number[] => {
    const index = lutIndex(value, PALETTES.waves.max, LUT_SIZE) * 3;
    return Array.from(lut.subarray(index, index + 3));
  };

  it('colours each pixel from the lookup table at the interpolated value', () => {
    const image = pixels(2, 1);
    paintField(image, inside(2, 1), field([2, 2, 2, 2]));
    expect(rgba(image, 0, 0)).toEqual([...lutColor(2), FIELD_ALPHA]);
    expect(rgba(image, 1, 0)).toEqual([...lutColor(2), FIELD_ALPHA]);
  });

  it('interpolates between grid values', () => {
    const image = pixels(1, 1);
    paintField(image, inside(1, 1), field([1, 3, 1, 3]));
    expect(rgba(image, 0, 0)).toEqual([...lutColor(2), FIELD_ALPHA]);
  });

  it('reads the requested hour', () => {
    const image = pixels(1, 1);
    paintField(image, inside(1, 1), field([0, 0, 0, 0, 6, 6, 6, 6], 1));
    expect(rgba(image, 0, 0)).toEqual([...lutColor(6), FIELD_ALPHA]);
  });

  it('fades out beyond the grid and leaves pixels far outside transparent', () => {
    const image = pixels(3, 1);
    const lookup = { ...inside(3, 1), colsOutside: Float32Array.of(0.6, 1.2, 5) };
    paintField(image, lookup, field([2, 2, 2, 2]));
    expect(rgba(image, 0, 0)).toEqual([...lutColor(2), Math.floor(FIELD_ALPHA / 2)]);
    expect(rgba(image, 1, 0)).toEqual([0, 0, 0, 0]);
    expect(rgba(image, 2, 0)).toEqual([0, 0, 0, 0]);
  });

  it('uses the larger of the row and column distance outside the grid', () => {
    const image = pixels(1, 1);
    const lookup = {
      ...inside(1, 1),
      rowsOutside: Float32Array.of(1.5),
      colsOutside: Float32Array.of(0),
    };
    paintField(image, lookup, field([2, 2, 2, 2]));
    expect(rgba(image, 0, 0)).toEqual([0, 0, 0, 0]);
  });

  it('leaves pixels transparent where the forecast has no data', () => {
    const image = pixels(1, 1);
    paintField(image, inside(1, 1), field([NaN, 2, 2, 2]));
    expect(rgba(image, 0, 0)).toEqual([0, 0, 0, 0]);
  });

  it('clears what an earlier draw left in the buffer', () => {
    const image = pixels(1, 1);
    image.data.fill(255);
    paintField(image, inside(1, 1), field([NaN, NaN, NaN, NaN]));
    expect(rgba(image, 0, 0)).toEqual([0, 0, 0, 0]);
  });
});
