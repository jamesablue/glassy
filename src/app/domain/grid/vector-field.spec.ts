import { directionFromVector, toVectorField } from './vector-field';

describe('toVectorField', () => {
  it('points vectors the way the wind blows, opposite to where it comes from', () => {
    const { u, v } = toVectorField([10, 10, 10, 10], [0, 90, 180, 270]);
    // From the north → toward the south (negative v); from the east → toward the west (negative u).
    expect([u[0], v[0]]).toEqual([expect.closeTo(0, 5), -10]);
    expect([u[1], v[1]]).toEqual([-10, expect.closeTo(0, 5)]);
    expect([u[2], v[2]]).toEqual([expect.closeTo(0, 5), 10]);
    expect([u[3], v[3]]).toEqual([10, expect.closeTo(0, 5)]);
  });

  it('scales by the magnitude', () => {
    const { u, v } = toVectorField([2], [225]);
    expect(u[0]).toBeCloseTo(Math.SQRT2, 5);
    expect(v[0]).toBeCloseTo(Math.SQRT2, 5);
  });

  it('stores components as 32-bit floats', () => {
    const field = toVectorField(Float32Array.of(1, 2, 3), Float32Array.of(0, 0, 0));
    expect(field.u).toBeInstanceOf(Float32Array);
    expect(field.v).toHaveLength(3);
  });

  it('leaves missing values as NaN', () => {
    const { u, v } = toVectorField([NaN, 5], [90, NaN]);
    expect([u[0], v[0], u[1], v[1]]).toEqual([NaN, NaN, NaN, NaN]);
  });
});

describe('directionFromVector', () => {
  it.each([0, 45, 90, 135, 180, 225, 270, 315, 359])(
    'recovers %s° from its travel vector',
    (direction) => {
      const { u, v } = toVectorField([7], [direction]);
      expect(directionFromVector(u[0] ?? NaN, v[0] ?? NaN)).toBeCloseTo(direction, 3);
    },
  );

  it('always returns a bearing from 0 up to 360', () => {
    expect(directionFromVector(1, 0)).toBe(270);
    expect(directionFromVector(-1, 0)).toBe(90);
    expect(directionFromVector(0, -1)).toBe(0);
  });
});
