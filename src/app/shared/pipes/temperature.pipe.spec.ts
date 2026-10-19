import { TemperaturePipe } from './temperature.pipe';

describe('TemperaturePipe', () => {
  const pipe = new TemperaturePipe();

  it('shows °C in the chosen unit, with the unit', () => {
    expect(pipe.transform(26, 'f')).toBe('79°F');
    expect(pipe.transform(26, 'c')).toBe('26.0°C');
  });

  it('shows a dash for a missing value', () => {
    expect(pipe.transform(NaN, 'c')).toBe('—');
    expect(pipe.transform(null, 'f')).toBe('—');
  });
});
