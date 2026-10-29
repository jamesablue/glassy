import { FLAT, surfRange, surfText } from './surf-range';

describe('surfRange', () => {
  describe('in feet', () => {
    it('calls anything under 0.4 ft flat', () => {
      expect(surfRange(0, 'ft')).toBe(FLAT);
      expect(surfRange(0.12, 'ft')).toBe(FLAT);
    });

    it('calls anything from 0.4 ft up to 1 ft "0–1"', () => {
      expect(surfRange(0.122, 'ft')).toBe('0–1');
      expect(surfRange(0.3, 'ft')).toBe('0–1');
    });

    it.each([
      [0.305, '1–2'],
      [0.6, '1–2'],
      [1, '2–4'],
      [2, '5–8'],
      [3, '7–12'],
    ])('quotes %s m as %s', (meters, range) => {
      expect(surfRange(meters, 'ft')).toBe(range);
    });

    it('quotes 1.16 ft as "1–2", not "0–1" (#58)', () => {
      expect(surfRange(1.16 / 3.28084, 'ft')).toBe('1–2');
    });

    it('stretches the top of the range to cover the estimate', () => {
      expect(surfRange(2.05 / 3.28084, 'ft')).toBe('1–3');
    });

    it('always contains the estimate', () => {
      for (let feet = 0.4; feet < 40; feet += 0.01) {
        const [low = NaN, high = NaN] = surfRange(feet / 3.28084, 'ft')
          .split('–')
          .map(Number);
        expect(low).toBeLessThanOrEqual(feet + 1e-9);
        expect(high).toBeGreaterThanOrEqual(feet - 1e-9);
      }
    });

    it('always quotes whole feet at least 1 ft apart', () => {
      for (let feet = 1; feet < 40; feet += 0.05) {
        const [low = NaN, high = NaN] = surfRange(feet / 3.28084, 'ft')
          .split('–')
          .map(Number);
        expect(Number.isInteger(low) && Number.isInteger(high)).toBe(true);
        expect(high - low).toBeGreaterThanOrEqual(1);
      }
    });
  });

  describe('in metres', () => {
    it('calls anything under 0.12 m flat', () => {
      expect(surfRange(0, 'm')).toBe(FLAT);
      expect(surfRange(0.119, 'm')).toBe(FLAT);
    });

    it.each([
      [0.12, '0.1–0.1'],
      [0.5, '0.4–0.6'],
      [1, '0.8–1.2'],
      [2.5, '2.0–3.0'],
    ])('quotes %s m as %s', (meters, range) => {
      expect(surfRange(meters, 'm')).toBe(range);
    });
  });
});

describe('surfText', () => {
  it('adds the unit to a range', () => {
    expect(surfText(1, 'ft')).toBe('2–4 ft');
    expect(surfText(1, 'm')).toBe('0.8–1.2 m');
  });

  it('leaves flat on its own', () => {
    expect(surfText(0, 'ft')).toBe(FLAT);
    expect(surfText(0, 'm')).toBe(FLAT);
  });
});
