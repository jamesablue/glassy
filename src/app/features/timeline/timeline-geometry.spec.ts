import { hourAtOffset, hourForKey, hourPercent, HOURS_PER_PAGE } from './timeline-geometry';

describe('hourAtOffset', () => {
  it('gives each hour an equal slice of the strip', () => {
    expect(hourAtOffset(0, 480, 48)).toBe(0);
    expect(hourAtOffset(9.99, 480, 48)).toBe(0);
    expect(hourAtOffset(10, 480, 48)).toBe(1);
    expect(hourAtOffset(255, 480, 48)).toBe(25);
    expect(hourAtOffset(479.9, 480, 48)).toBe(47);
  });

  it('picks the first or last hour past either end', () => {
    expect(hourAtOffset(-40, 480, 48)).toBe(0);
    expect(hourAtOffset(480, 480, 48)).toBe(47);
    expect(hourAtOffset(5000, 480, 48)).toBe(47);
  });

  it('has nothing to pick on an empty or unmeasured strip', () => {
    expect(hourAtOffset(100, 480, 0)).toBe(0);
    expect(hourAtOffset(100, 0, 48)).toBe(0);
  });
});

describe('hourPercent', () => {
  it('places an hour along the strip', () => {
    expect(hourPercent(0, 48)).toBe(0);
    expect(hourPercent(12, 48)).toBe(25);
    expect(hourPercent(8.5, 48)).toBeCloseTo(17.708, 3);
    expect(hourPercent(48, 48)).toBe(100);
  });

  it('is 0 without a forecast', () => {
    expect(hourPercent(3, 0)).toBe(0);
  });
});

describe('hourForKey', () => {
  it.each([
    ['ArrowRight', 11],
    ['ArrowUp', 11],
    ['ArrowLeft', 9],
    ['ArrowDown', 9],
    ['PageUp', 10 + HOURS_PER_PAGE],
    ['PageDown', 10 - HOURS_PER_PAGE],
    ['Home', 0],
    ['End', 47],
  ])('moves %s from hour 10 to %s', (key, hour) => {
    expect(hourForKey(key, 10, 48)).toBe(hour);
  });

  it('ignores other keys', () => {
    expect(hourForKey('Enter', 10, 48)).toBeNull();
    expect(hourForKey(' ', 10, 48)).toBeNull();
  });
});
