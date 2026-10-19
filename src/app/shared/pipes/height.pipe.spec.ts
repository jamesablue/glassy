import { HeightPipe } from './height.pipe';

describe('HeightPipe', () => {
  const pipe = new HeightPipe();

  it('shows metres in the chosen unit without the unit', () => {
    expect(pipe.transform(1, 'ft')).toBe('3.3');
    expect(pipe.transform(1, 'm')).toBe('1.0');
    expect(pipe.transform(3.2, 'ft')).toBe('10');
  });

  it.each([NaN, null, undefined])('shows a dash for a missing value (%s)', (value) => {
    expect(pipe.transform(value, 'ft')).toBe('—');
  });
});
