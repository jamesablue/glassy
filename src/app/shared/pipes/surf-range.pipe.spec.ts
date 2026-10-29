import { SurfRangePipe } from './surf-range.pipe';

describe('SurfRangePipe', () => {
  const pipe = new SurfRangePipe();

  it('quotes surf as a range with its unit', () => {
    expect(pipe.transform(1, 'ft')).toBe('3–4 ft');
    expect(pipe.transform(1, 'm')).toBe('0.8–1.2 m');
  });

  it('calls small surf flat, without a unit', () => {
    expect(pipe.transform(0.05, 'ft')).toBe('Flat');
  });

  it('shows a dash for a missing value', () => {
    expect(pipe.transform(NaN, 'ft')).toBe('—');
  });
});
