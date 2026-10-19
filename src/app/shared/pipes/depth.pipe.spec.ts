import { DepthPipe } from './depth.pipe';

describe('DepthPipe', () => {
  const pipe = new DepthPipe();

  it('shows a depth in the height unit, with the unit', () => {
    expect(pipe.transform(8.5, 'ft')).toBe('28 ft');
    expect(pipe.transform(8.5, 'm')).toBe('8.5 m');
    expect(pipe.transform(152.6, 'm')).toBe('153 m');
  });

  it('shows a dash for a missing value', () => {
    expect(pipe.transform(NaN, 'ft')).toBe('—');
  });
});
