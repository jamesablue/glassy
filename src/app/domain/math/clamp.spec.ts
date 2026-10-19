import { clamp } from './clamp';

describe('clamp', () => {
  it('keeps values inside the range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });

  it('limits values to either end', () => {
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
  });

  it('keeps the ends themselves', () => {
    expect(clamp(0, 0, 10)).toBe(0);
    expect(clamp(10, 0, 10)).toBe(10);
  });

  it('leaves NaN as NaN', () => {
    expect(clamp(NaN, 0, 10)).toBeNaN();
  });
});
