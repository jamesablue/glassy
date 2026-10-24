import { OAHU_SPOTS, type GridSpec } from '@glassy/shared';
import { offshorePoint } from '../geo/offshore-point';
import { DEFAULT_INGEST_SETTINGS } from '../ingest/settings';
import { readManifest } from '../ingest/fixtures';
import { testSpot } from '../testing/builders';
import {
  buildOpenMeteoUrl,
  forecastCallCount,
  forecastRequestUrls,
  GRID_MARINE_VARS,
  GRID_WIND_VARS,
  SPOT_MARINE_VARS,
  SPOT_WEATHER_VARS,
  weightedCalls,
} from './urls';

/** The query parameters of a URL, in order, with values decoded. */
function paramsOf(url: string): [string, string][] {
  return [...new URL(url).searchParams.entries()];
}

describe('buildOpenMeteoUrl', () => {
  const base = 'https://api.example.com/v1/forecast';
  const query = {
    points: [
      { lat: 21.25, lon: -157.8125 },
      { lat: 21.5, lon: -158 },
    ],
    hourly: ['wind_speed_10m', 'is_day'],
    forecastDays: 5,
    timeZone: 'Pacific/Honolulu',
  };

  it('asks for hourly values in local days with Unix timestamps', () => {
    expect(buildOpenMeteoUrl(base, query)).toBe(
      `${base}?latitude=21.25,21.5&longitude=-157.8125,-158&hourly=wind_speed_10m,is_day` +
        '&forecast_days=5&timezone=Pacific%2FHonolulu&timeformat=unixtime',
    );
  });

  it('rounds coordinates when asked to', () => {
    const url = buildOpenMeteoUrl(base, { ...query, coordinateDecimals: 3 });
    expect(paramsOf(url).slice(0, 2)).toEqual([
      ['latitude', '21.250,21.500'],
      ['longitude', '-157.813,-158.000'],
    ]);
  });

  it('adds the wind speed unit and cell selection last', () => {
    const url = buildOpenMeteoUrl(base, {
      ...query,
      windSpeedUnit: 'ms',
      cellSelection: 'nearest',
    });
    expect(url.endsWith('&timeformat=unixtime&wind_speed_unit=ms&cell_selection=nearest')).toBe(
      true,
    );
  });

  it('percent-encodes each value but keeps the list commas', () => {
    const url = buildOpenMeteoUrl(base, { ...query, hourly: ['a b', 'c&d'], timeZone: 'GMT+10' });
    expect(url).toContain('&hourly=a%20b,c%26d&');
    expect(url).toContain('&timezone=GMT%2B10&');
    expect(new URL(url).searchParams.get('hourly')).toBe('a b,c&d');
  });
});

describe('forecastRequestUrls', () => {
  const grid: GridSpec = { lat0: 21, lon0: -158, step: 0.125, rows: 2, cols: 2 };
  const spots = [
    testSpot({ id: 'a', lat: 21.27, lon: -157.75, facing: 180 }),
    testSpot({ id: 'b', lat: 21.65, lon: -158.06, facing: 300 }),
  ];
  const urls = forecastRequestUrls({ ...DEFAULT_INGEST_SETTINGS, grid }, spots);
  const marine = DEFAULT_INGEST_SETTINGS.openMeteoMarineUrl;
  const forecast = DEFAULT_INGEST_SETTINGS.openMeteoForecastUrl;
  const local = '&forecast_days=5&timezone=Pacific%2FHonolulu&timeformat=unixtime';
  const gridLatLon =
    'latitude=21.000,21.000,21.125,21.125&longitude=-158.000,-157.875,-158.000,-157.875';

  it('asks for sea state at every grid cell, from the nearest sea cell', () => {
    expect(urls.gridMarine).toBe(
      `${marine}?${gridLatLon}&hourly=${GRID_MARINE_VARS.join(',')}${local}&cell_selection=sea`,
    );
  });

  it('asks for wind at every grid cell in m/s', () => {
    expect(urls.gridWind).toBe(
      `${forecast}?${gridLatLon}&hourly=${GRID_WIND_VARS.join(',')}${local}&wind_speed_unit=ms`,
    );
  });

  it('asks for marine values offshore of each spot, from the nearest sea cell', () => {
    const [a, b] = spots.map((spot) => offshorePoint(spot, 6));
    expect(urls.spotMarine).toBe(
      `${marine}?latitude=${a?.lat.toFixed(4)},${b?.lat.toFixed(4)}` +
        `&longitude=${a?.lon.toFixed(4)},${b?.lon.toFixed(4)}` +
        `&hourly=${SPOT_MARINE_VARS.join(',')}${local}&cell_selection=sea`,
    );
    // 6 km south of a south-facing spot.
    expect(a?.lat).toBeCloseTo(21.27 - 6 / 111.32, 6);
  });

  it('asks for weather at each spot itself, from the nearest cell', () => {
    expect(urls.spotWeather).toBe(
      `${forecast}?latitude=21.27,21.65&longitude=-157.75,-158.06` +
        `&hourly=${SPOT_WEATHER_VARS.join(',')}${local}&wind_speed_unit=ms&cell_selection=nearest`,
    );
  });

  it('reads marine values as far offshore as configured', () => {
    const near = forecastRequestUrls({ ...DEFAULT_INGEST_SETTINGS, offshoreDistanceKm: 3 }, spots);
    const point = offshorePoint(spots[0] ?? testSpot(), 3);
    const latitudes = new URL(near.spotMarine).searchParams.get('latitude')?.split(',');
    expect(latitudes?.[0]).toBe(point.lat.toFixed(4));
  });

  it('lists the whole Oahu grid and catalog for the defaults', () => {
    const live = forecastRequestUrls(DEFAULT_INGEST_SETTINGS, OAHU_SPOTS);
    const count = (url: string): number =>
      new URL(url).searchParams.get('latitude')?.split(',').length ?? 0;
    expect(count(live.gridMarine)).toBe(165);
    expect(count(live.gridWind)).toBe(165);
    expect(count(live.spotMarine)).toBe(OAHU_SPOTS.length);
    expect(count(live.spotWeather)).toBe(OAHU_SPOTS.length);
  });

  it('keeps the variable lists of the original prototype', () => {
    expect(GRID_MARINE_VARS).toHaveLength(6);
    expect(GRID_WIND_VARS).toEqual(['wind_speed_10m', 'wind_direction_10m']);
    expect(SPOT_MARINE_VARS).toHaveLength(13);
    expect(SPOT_WEATHER_VARS).toEqual([
      'wind_speed_10m',
      'wind_direction_10m',
      'wind_gusts_10m',
      'is_day',
      'precipitation_probability',
    ]);
  });
});

describe('the recorded fixtures', () => {
  it('were recorded with the requests the ingest makes', async () => {
    const { openMeteo } = await readManifest();
    const urls = forecastRequestUrls(DEFAULT_INGEST_SETTINGS, OAHU_SPOTS);
    expect(openMeteo.requests.gridMarine.url).toBe(urls.gridMarine);
    expect(openMeteo.requests.gridWind.url).toBe(urls.gridWind);
    expect(openMeteo.requests.spotMarine.url).toBe(urls.spotMarine);
    expect(openMeteo.requests.spotWeather.url).toBe(urls.spotWeather);
  });
});

describe('weightedCalls', () => {
  it('counts each location once for up to 10 variables and 14 days', () => {
    expect(weightedCalls(165, 6, 5)).toBe(165);
    expect(weightedCalls(1, 10, 14)).toBe(1);
  });

  it('counts more for more variables or days', () => {
    expect(weightedCalls(25, 13, 5)).toBeCloseTo(32.5);
    expect(weightedCalls(1, 5, 16)).toBeCloseTo(16 / 14);
    expect(weightedCalls(2, 20, 28)).toBe(8);
  });
});

describe('forecastCallCount', () => {
  it('is about 388 calls a run for the Oahu grid and catalog (ADR-0010)', () => {
    const count = forecastCallCount(DEFAULT_INGEST_SETTINGS, OAHU_SPOTS.length);
    expect(count.requests).toEqual({
      gridMarine: 165,
      gridWind: 165,
      spotMarine: expect.closeTo(32.5),
      spotWeather: 25,
    });
    expect(count.total).toBeCloseTo(387.5);
  });
});
