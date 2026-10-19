import { formatDepth, formatHeight, formatSpeed, formatTemperature } from './format';

describe('formatHeight', () => {
  it('shows one decimal below 10', () => {
    expect(formatHeight(1, 'ft')).toBe('3.3');
    expect(formatHeight(1, 'm')).toBe('1.0');
    expect(formatHeight(2.9, 'ft')).toBe('9.5');
  });

  it('shows whole numbers from 10 up', () => {
    expect(formatHeight(3.048, 'ft')).toBe('10');
    expect(formatHeight(12.4, 'm')).toBe('12');
  });

  it('keeps the sign of negative heights', () => {
    expect(formatHeight(-0.3, 'ft')).toBe('-1.0');
  });
});

describe('formatSpeed', () => {
  it.each([
    ['kt', '19'],
    ['mph', '22'],
    ['kmh', '36'],
    ['ms', '10'],
  ] as const)('converts 10 m/s to whole %s', (unit, text) => {
    expect(formatSpeed(10, unit)).toBe(text);
  });
});

describe('formatTemperature', () => {
  it('shows whole degrees Fahrenheit', () => {
    expect(formatTemperature(26, 'f')).toBe('79°F');
    expect(formatTemperature(0, 'f')).toBe('32°F');
  });

  it('shows Celsius to one decimal', () => {
    expect(formatTemperature(26, 'c')).toBe('26.0°C');
    expect(formatTemperature(25.94, 'c')).toBe('25.9°C');
  });
});

describe('formatDepth', () => {
  it('shows whole feet', () => {
    expect(formatDepth(10, 'ft')).toBe('33 ft');
    expect(formatDepth(0.2, 'ft')).toBe('1 ft');
  });

  it('shows metres to one decimal below 10 m and whole metres from there', () => {
    expect(formatDepth(4.5, 'm')).toBe('4.5 m');
    expect(formatDepth(10, 'm')).toBe('10 m');
    expect(formatDepth(152.6, 'm')).toBe('153 m');
  });
});
