import { SpeedPipe } from './speed.pipe';

describe('SpeedPipe', () => {
  const pipe = new SpeedPipe();

  it.each([
    ['kt', '19'],
    ['mph', '22'],
    ['kmh', '36'],
    ['ms', '10'],
  ] as const)('shows 10 m/s as whole %s', (unit, text) => {
    expect(pipe.transform(10, unit)).toBe(text);
  });

  it('shows a dash for a missing value', () => {
    expect(pipe.transform(NaN, 'kt')).toBe('—');
    expect(pipe.transform(undefined, 'kt')).toBe('—');
  });
});
