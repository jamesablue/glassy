import type { PointSample, UnitSettings } from '../../../domain/models';
import type { PointReading } from '../../../state';
import { elevationText, readoutRows, readoutTitle } from './readout-rows';

describe('point readout', () => {
  const FEET: UnitSettings = { height: 'ft', speed: 'kt', temperature: 'f' };
  const METRES: UnitSettings = { height: 'm', speed: 'kmh', temperature: 'c' };
  const SAMPLE: PointSample = {
    windSpeed: 10,
    windDirection: 70,
    waveHeight: 1.2,
    wavePeriod: 8.4,
    waveDirection: 45,
    swellHeight: 0.9,
    swellPeriod: 13.6,
    swellDirection: 200,
  };
  /** 3 PM on Sunday 18 October 2026 in Honolulu. */
  const SUNDAY_3PM = Date.UTC(2026, 9, 19, 1) / 1000;
  const reading = (overrides: Partial<PointReading> = {}): PointReading => ({
    point: { lat: 21.269, lon: -157.69364 },
    time: SUNDAY_3PM,
    forecast: { status: 'ready', sample: SAMPLE },
    elevation: { status: 'ready', meters: -8.5 },
    ...overrides,
  });

  describe('readoutTitle', () => {
    it('gives the point to four decimals and the hour shown', () => {
      expect(readoutTitle(reading())).toBe('21.2690°, -157.6936° · Sun 3 PM');
    });

    it('leaves the hour out before a forecast loads', () => {
      expect(readoutTitle(reading({ time: undefined }))).toBe('21.2690°, -157.6936°');
    });
  });

  describe('readoutRows', () => {
    it('lists wind, waves and swell with arrows pointing where they travel', () => {
      expect(readoutRows(reading(), FEET)).toEqual([
        { label: 'Wind', value: '19 kt ENE', heading: 250 },
        { label: 'Waves', value: '3.9 ft · 8s', heading: 225 },
        { label: 'Swell', value: '3.0 ft · 14s', heading: 20 },
        { label: 'Depth', value: '28 ft' },
      ]);
    });

    it('follows the chosen units', () => {
      const rows = readoutRows(reading(), METRES);
      expect(rows.map((row) => row.value)).toEqual([
        '36 km/h ENE',
        '1.2 m · 8s',
        '0.9 m · 14s',
        '8.5 m',
      ]);
    });

    it('shows a dash where the forecast has no data and drops arrows without a direction', () => {
      const gappy = { ...SAMPLE, waveHeight: NaN, swellDirection: NaN };
      const rows = readoutRows(reading({ forecast: { status: 'ready', sample: gappy } }), FEET);
      expect(rows[1]).toEqual({ label: 'Waves', value: '—' });
      expect(rows[2]).toEqual({ label: 'Swell', value: '3.0 ft · 14s' });
    });

    it('says when the point is off the forecast grid', () => {
      expect(readoutRows(reading({ forecast: { status: 'outside' } }), FEET)).toEqual([
        { label: 'Forecast', value: 'outside area' },
        { label: 'Depth', value: '28 ft' },
      ]);
    });

    it('says when the forecast is still loading', () => {
      expect(readoutRows(reading({ forecast: { status: 'loading' } }), FEET)[0]).toEqual({
        label: 'Forecast',
        value: 'loading…',
      });
    });
  });

  describe('elevationText', () => {
    it('shows water depth', () => {
      expect(elevationText({ status: 'ready', meters: -8.5 }, 'ft')).toBe('28 ft');
      expect(elevationText({ status: 'ready', meters: -8.5 }, 'm')).toBe('8.5 m');
    });

    it('shows the height of land, sea level included', () => {
      expect(elevationText({ status: 'ready', meters: 63.3 }, 'ft')).toBe('land · 208 ft elev.');
      expect(elevationText({ status: 'ready', meters: 0 }, 'm')).toBe('land · 0.0 m elev.');
    });

    it('shows progress, then a dash when there is no answer', () => {
      expect(elevationText({ status: 'loading' }, 'ft')).toBe('loading…');
      expect(elevationText({ status: 'no-data' }, 'ft')).toBe('—');
      expect(elevationText({ status: 'error' }, 'ft')).toBe('—');
    });
  });
});
