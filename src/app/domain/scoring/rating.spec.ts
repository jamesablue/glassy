import { RATINGS, rateScore } from './rating';

describe('rateScore', () => {
  it.each([
    [10, 'Excellent'],
    [8, 'Excellent'],
    [7.99, 'Good'],
    [6.5, 'Good'],
    [6.49, 'Fair'],
    [5, 'Fair'],
    [4.99, 'Poor'],
    [3, 'Poor'],
    [2.99, 'Hazardous'],
    [0, 'Hazardous'],
    [-1, 'Hazardous'],
  ])('rates %s as %s', (score, label) => {
    expect(rateScore(score).label).toBe(label);
  });

  it('rates a missing score as hazardous', () => {
    expect(rateScore(NaN).label).toBe('Hazardous');
  });

  it('returns the band with its colour', () => {
    expect(rateScore(9)).toEqual({ label: 'Excellent', min: 8, color: '#34d399' });
  });
});

describe('RATINGS', () => {
  it('lists bands from best to worst', () => {
    const minimums = RATINGS.map((rating) => rating.min);
    expect(minimums).toEqual([...minimums].sort((a, b) => b - a));
  });

  it('ends with a band that catches every score', () => {
    expect(RATINGS.at(-1)?.min).toBe(-Infinity);
  });
});
