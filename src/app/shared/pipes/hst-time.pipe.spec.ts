import { HstTimePipe } from './hst-time.pipe';

describe('HstTimePipe', () => {
  const pipe = new HstTimePipe();
  /** 3 PM on Sunday 18 October 2026 in Honolulu. */
  const SUNDAY_3PM = Date.UTC(2026, 9, 19, 1) / 1000;

  it('shows the weekday and hour in Hawaii time by default', () => {
    expect(pipe.transform(SUNDAY_3PM)).toBe('Sun 3 PM');
  });

  it.each([
    ['time', 'Sun 3 PM'],
    ['hour', '3 PM'],
    ['weekday', 'Sun'],
    ['day', 'Sun 18'],
  ] as const)('shows the %s', (format, text) => {
    expect(pipe.transform(SUNDAY_3PM, format)).toBe(text);
  });

  it('shows a dash for a missing time', () => {
    expect(pipe.transform(undefined)).toBe('—');
    expect(pipe.transform(NaN, 'hour')).toBe('—');
  });
});
