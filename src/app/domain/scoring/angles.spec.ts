import { angularDifference } from './angles';

describe('angularDifference', () => {
  it.each([
    [0, 0, 0],
    [90, 45, 45],
    [45, 90, 45],
    [0, 180, 180],
    [90, 270, 180],
  ])('%d° and %d° are %d° apart', (a, b, expected) => {
    expect(angularDifference(a, b)).toBe(expected);
  });

  it('takes the short way round across north', () => {
    expect(angularDifference(350, 10)).toBe(20);
    expect(angularDifference(10, 350)).toBe(20);
    expect(angularDifference(0, 359)).toBe(1);
  });

  it('accepts negative bearings and bearings past 360', () => {
    expect(angularDifference(-90, 270)).toBe(0);
    expect(angularDifference(765, 0)).toBe(45);
    expect(angularDifference(-10, 10)).toBe(20);
  });

  it('never exceeds 180°', () => {
    for (let a = -720; a <= 720; a += 37) {
      for (let b = 0; b < 360; b += 29) {
        const difference = angularDifference(a, b);
        expect(difference).toBeGreaterThanOrEqual(0);
        expect(difference).toBeLessThanOrEqual(180);
      }
    }
  });

  it('is NaN when a bearing is missing', () => {
    expect(angularDifference(NaN, 10)).toBeNaN();
  });
});
