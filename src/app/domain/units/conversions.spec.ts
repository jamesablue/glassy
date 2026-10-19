import {
  celsiusToFahrenheit,
  HEIGHT_FACTORS,
  KMH_PER_KNOT,
  KNOTS_PER_METER_PER_SECOND,
  SPEED_FACTORS,
  SPEED_LABELS,
} from './conversions';

describe('unit conversions', () => {
  it('stores heights and speeds in SI units', () => {
    expect(HEIGHT_FACTORS.m).toBe(1);
    expect(SPEED_FACTORS.ms).toBe(1);
  });

  it('uses consistent speed factors', () => {
    expect(SPEED_FACTORS.kmh).toBe(3.6);
    expect(KNOTS_PER_METER_PER_SECOND * KMH_PER_KNOT).toBeCloseTo(SPEED_FACTORS.kmh, 5);
    expect(SPEED_FACTORS.mph / SPEED_FACTORS.kt).toBeCloseTo(1.15078, 5);
  });

  it('labels every speed unit', () => {
    expect(SPEED_LABELS).toEqual({ kt: 'kt', mph: 'mph', kmh: 'km/h', ms: 'm/s' });
  });

  it.each([
    [0, 32],
    [100, 212],
    [-40, -40],
    [26, 78.8],
  ])('converts %s °C to %s °F', (celsius, fahrenheit) => {
    expect(celsiusToFahrenheit(celsius)).toBeCloseTo(fahrenheit, 10);
  });
});
