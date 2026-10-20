import { sampleSpot } from '../../domain/forecast';
import type { GridSpec } from '../../domain/models';
import {
  codedResponse,
  hourlyTimes,
  openMeteoLocation,
  valueCode,
} from '../../../testing/open-meteo-builders';
import {
  packHourly,
  sharedHours,
  toForecastBundle,
  toSpotForecastBundle,
  withGrid,
} from './open-meteo.adapter';
import type { OpenMeteoForecastResponses } from './open-meteo.types';
import {
  GRID_MARINE_VARS,
  GRID_WIND_VARS,
  SPOT_MARINE_VARS,
  SPOT_WEATHER_VARS,
} from './open-meteo.urls';

const START = 1_800_000_000;
const HOUR = 3600;

describe('packHourly', () => {
  const times = hourlyTimes(START, 4);

  it('lays values out hour by hour, one per location', () => {
    const packed = packHourly(codedResponse(['a', 'b'], 3, times), ['a', 'b']);
    expect(packed.times).toEqual(times);
    expect(packed.locationCount).toBe(3);
    expect(packed.values.a).toBeInstanceOf(Float32Array);
    expect(packed.values.a).toHaveLength(4 * 3);
    // hour 2, location 1 of variable "b"
    expect(packed.values.b[2 * 3 + 1]).toBe(valueCode(1, 1, 2));
    expect(Array.from(packed.values.a.subarray(0, 3))).toEqual([
      valueCode(0, 0, 0),
      valueCode(0, 1, 0),
      valueCode(0, 2, 0),
    ]);
  });

  it('turns nulls, short series and missing variables into NaN', () => {
    const response = [
      openMeteoLocation<'a' | 'b'>({ time: times, a: [1, null, 3, 4] }),
      openMeteoLocation<'a' | 'b'>({ time: times, a: [5, 6], b: [7, 8, 9, 10] }),
    ];
    const packed = packHourly(response, ['a', 'b']);
    expect(Array.from(packed.values.a)).toEqual([1, 5, NaN, 6, 3, NaN, 4, NaN]);
    expect(Array.from(packed.values.b)).toEqual([NaN, 7, NaN, 8, NaN, 9, NaN, 10]);
  });

  it('accepts the bare object sent for a single location', () => {
    const packed = packHourly(openMeteoLocation({ time: times, a: [1, 2, 3, 4] }), ['a']);
    expect(packed.locationCount).toBe(1);
    expect(Array.from(packed.values.a)).toEqual([1, 2, 3, 4]);
  });

  it('cuts the series to a range of hours', () => {
    const packed = packHourly(codedResponse(['a'], 2, times), ['a'], {
      start: START + HOUR,
      hourCount: 2,
    });
    expect(packed.times).toEqual([START + HOUR, START + 2 * HOUR]);
    expect(Array.from(packed.values.a)).toEqual([
      valueCode(0, 0, 1),
      valueCode(0, 1, 1),
      valueCode(0, 0, 2),
      valueCode(0, 1, 2),
    ]);
  });

  it('rejects a range that is not in the response', () => {
    const response = codedResponse(['a'], 1, times);
    expect(() => packHourly(response, ['a'], { start: START - HOUR, hourCount: 1 })).toThrow(
      RangeError,
    );
    expect(() => packHourly(response, ['a'], { start: START + HOUR, hourCount: 4 })).toThrow(
      RangeError,
    );
  });

  it('rejects a response without locations', () => {
    expect(() => packHourly([], ['a'])).toThrow(/no locations/);
  });
});

describe('sharedHours', () => {
  it('keeps axes that already match', () => {
    const axis = hourlyTimes(START, 5);
    expect(sharedHours([axis, axis])).toEqual({ start: START, hourCount: 5 });
  });

  it('starts at the latest first hour and stops at the earliest last hour', () => {
    expect(
      sharedHours([
        hourlyTimes(START, 5),
        hourlyTimes(START - HOUR, 6), // starts an hour earlier
        hourlyTimes(START, 3), // ends two hours earlier
      ]),
    ).toEqual({ start: START, hourCount: 3 });
    expect(sharedHours([hourlyTimes(START, 5), hourlyTimes(START + HOUR, 5)])).toEqual({
      start: START + HOUR,
      hourCount: 4,
    });
  });

  it('rejects axes with no hours in common', () => {
    expect(() => sharedHours([hourlyTimes(START, 2), hourlyTimes(START + 5 * HOUR, 2)])).toThrow(
      /no hours in common/,
    );
    expect(() => sharedHours([hourlyTimes(START, 2), [START + 1800]])).toThrow();
    expect(() => sharedHours([hourlyTimes(START, 2), []])).toThrow();
    expect(() => sharedHours([])).toThrow();
  });
});

describe('toForecastBundle', () => {
  // Two cells side by side and two spots.
  const grid: GridSpec = { lat0: 21, lon0: -158, step: 0.125, rows: 1, cols: 2 };
  const times = hourlyTimes(START, 3);

  function responses(
    overrides: Partial<OpenMeteoForecastResponses> = {},
  ): OpenMeteoForecastResponses {
    return {
      gridMarine: codedResponse(GRID_MARINE_VARS, 2, times),
      gridWind: codedResponse(GRID_WIND_VARS, 2, times),
      spotMarine: codedResponse(SPOT_MARINE_VARS, 2, times),
      spotWeather: codedResponse(SPOT_WEATHER_VARS, 2, times),
      ...overrides,
    };
  }
  const marine = (name: (typeof SPOT_MARINE_VARS)[number], spot: number, hour: number): number =>
    valueCode(SPOT_MARINE_VARS.indexOf(name), spot, hour);
  const weather = (name: (typeof SPOT_WEATHER_VARS)[number], spot: number, hour: number): number =>
    valueCode(SPOT_WEATHER_VARS.indexOf(name), spot, hour);

  it('maps every spot series to its Open-Meteo variable', () => {
    const { spots } = toForecastBundle(responses(), grid, 2);
    expect(spots.spotCount).toBe(2);
    expect(spots.hourCount).toBe(3);
    expect(sampleSpot(spots, 1, 1)).toEqual({
      primarySwell: {
        height: marine('swell_wave_height', 1, 1),
        period: marine('swell_wave_period', 1, 1),
        direction: marine('swell_wave_direction', 1, 1),
      },
      secondarySwell: {
        height: marine('secondary_swell_wave_height', 1, 1),
        period: marine('secondary_swell_wave_period', 1, 1),
        direction: marine('secondary_swell_wave_direction', 1, 1),
      },
      windWaves: {
        height: marine('wind_wave_height', 1, 1),
        period: marine('wind_wave_period', 1, 1),
        direction: marine('wind_wave_direction', 1, 1),
      },
      windSpeed: weather('wind_speed_10m', 1, 1),
      windDirection: weather('wind_direction_10m', 1, 1),
      windGust: weather('wind_gusts_10m', 1, 1),
      currentSpeed: marine('ocean_current_velocity', 1, 1),
      currentDirection: marine('ocean_current_direction', 1, 1),
      seaSurfaceTemperature: marine('sea_surface_temperature', 1, 1),
      seaLevel: marine('sea_level_height_msl', 1, 1),
      seaLevelNextHour: marine('sea_level_height_msl', 1, 2),
      rainChance: weather('precipitation_probability', 1, 1),
      isDay: true,
    });
  });

  it('maps the grid fields', () => {
    const { grid: forecast } = toForecastBundle(responses(), grid, 2);
    const at = (name: (typeof GRID_MARINE_VARS)[number]): number =>
      valueCode(GRID_MARINE_VARS.indexOf(name), 1, 2);
    const cell = 2 * 2 + 1; // hour 2, second cell
    expect(forecast.spec).toBe(grid);
    expect(forecast.fields.waveHeight[cell]).toBe(at('wave_height'));
    expect(forecast.fields.wavePeriod[cell]).toBe(at('wave_period'));
    expect(forecast.fields.swellHeight[cell]).toBe(at('swell_wave_height'));
    expect(forecast.fields.swellPeriod[cell]).toBe(at('swell_wave_period'));
    expect(forecast.fields.windSpeed[cell]).toBe(valueCode(0, 1, 2));
  });

  it('builds particle vectors that point the way wind and waves travel', () => {
    const constant = (value: number): number[] => times.map(() => value);
    const bundle = toForecastBundle(
      responses({
        gridWind: [0, 1].map(() =>
          openMeteoLocation({
            time: times,
            wind_speed_10m: constant(10),
            wind_direction_10m: constant(90), // from the east
          }),
        ),
        gridMarine: [0, 1].map(() =>
          openMeteoLocation({
            time: times,
            wave_period: constant(8),
            wave_direction: constant(180), // from the south
            swell_wave_period: constant(14),
            swell_wave_direction: [0, 0, null], // from the north, then unknown
          }),
        ),
      }),
      grid,
      2,
    );
    const { wind, waves, swell } = bundle.grid.vectors;
    expect(wind.u[0]).toBeCloseTo(-10, 5); // blowing west
    expect(wind.v[0]).toBeCloseTo(0, 5);
    // Wave and swell vectors use the period as their magnitude.
    expect(waves.u[0]).toBeCloseTo(0, 5);
    expect(waves.v[0]).toBeCloseTo(8, 5); // travelling north
    expect(swell.v[0]).toBeCloseTo(-14, 5); // travelling south
    expect(swell.u[2 * 2]).toBeNaN();
    expect(bundle.grid.fields.waveHeight[0]).toBeNaN(); // not in the response
  });

  it('takes the island-wide daylight flag from the first spot', () => {
    const bundle = toForecastBundle(
      responses({
        spotWeather: [
          openMeteoLocation({ time: times, is_day: [1, 0, null] }),
          openMeteoLocation({ time: times, is_day: [0, 1, 1] }, 1),
        ],
      }),
      grid,
      2,
    );
    expect(bundle.isDay).toEqual([true, false, false]);
  });

  it('lines every dataset up on the hours they share', () => {
    const bundle = toForecastBundle(
      responses({
        // The weather model starts an hour earlier and the grid wind ends an hour early.
        spotWeather: codedResponse(SPOT_WEATHER_VARS, 2, hourlyTimes(START - HOUR, 4)),
        gridWind: codedResponse(GRID_WIND_VARS, 2, hourlyTimes(START, 2)),
      }),
      grid,
      2,
    );
    expect(bundle.times).toEqual([START, START + HOUR]);
    expect(bundle.isDay).toHaveLength(2);
    expect(bundle.spots.hourCount).toBe(2);
    expect(bundle.grid.fields.waveHeight).toHaveLength(2 * 2);
    // Hour 0 of the bundle is hour 1 of the weather response.
    expect(bundle.spots.series.windSpeed[0 * 2 + 1]).toBe(weather('wind_speed_10m', 1, 1));
    expect(bundle.spots.series.swellHeight[1 * 2 + 1]).toBe(marine('swell_wave_height', 1, 1));
  });

  it('accepts single-location responses for a one-spot catalog', () => {
    const [onlyMarine] = codedResponse(SPOT_MARINE_VARS, 1, times);
    const [onlyWeather] = codedResponse(SPOT_WEATHER_VARS, 1, times);
    if (!onlyMarine || !onlyWeather) throw new Error('missing test data');
    const bundle = toForecastBundle(
      responses({ spotMarine: onlyMarine, spotWeather: onlyWeather }),
      grid,
      1,
    );
    expect(bundle.spots.spotCount).toBe(1);
    expect(sampleSpot(bundle.spots, 0, 2).windSpeed).toBe(weather('wind_speed_10m', 0, 2));
  });

  it('rejects responses that do not match the grid or the catalog', () => {
    expect(() => toForecastBundle(responses(), { ...grid, cols: 3 }, 2)).toThrow(
      /grid marine response has 2 locations instead of 3/,
    );
    expect(() =>
      toForecastBundle(responses({ gridWind: codedResponse(GRID_WIND_VARS, 1, times) }), grid, 2),
    ).toThrow(/grid wind/);
    expect(() => toForecastBundle(responses(), grid, 3)).toThrow(/spot marine/);
    expect(() =>
      toForecastBundle(
        responses({ spotWeather: codedResponse(SPOT_WEATHER_VARS, 1, times) }),
        grid,
        2,
      ),
    ).toThrow(/spot weather/);
  });

  describe('toSpotForecastBundle', () => {
    it('makes the same spot forecast from the spot responses alone', () => {
      const { spotMarine, spotWeather } = responses();
      const spots = toSpotForecastBundle({ spotMarine, spotWeather }, 2);
      const complete = toForecastBundle(responses(), grid, 2);

      expect(spots).toEqual({
        times: complete.times,
        isDay: complete.isDay,
        spots: complete.spots,
      });
      expect(spots).not.toHaveProperty('grid');
    });

    it('lines the two spot datasets up on the hours they share', () => {
      const spots = toSpotForecastBundle(
        {
          spotMarine: codedResponse(SPOT_MARINE_VARS, 2, times),
          spotWeather: codedResponse(SPOT_WEATHER_VARS, 2, hourlyTimes(START - HOUR, 3)),
        },
        2,
      );
      expect(spots.times).toEqual([START, START + HOUR]);
      expect(spots.spots.series.windSpeed[1]).toBe(weather('wind_speed_10m', 1, 1));
    });

    it('rejects responses that do not match the catalog', () => {
      const { spotMarine, spotWeather } = responses();
      expect(() => toSpotForecastBundle({ spotMarine, spotWeather }, 3)).toThrow(/spot marine/);
    });
  });

  describe('withGrid', () => {
    it('keeps the spot forecast as it is when the grid shares its hours', () => {
      const all = responses();
      const spots = toSpotForecastBundle(all, 2);
      const complete = withGrid(spots, all, grid, 2);

      expect(complete.times).toBe(spots.times);
      expect(complete.isDay).toBe(spots.isDay);
      expect(complete.spots).toBe(spots.spots);
      expect(complete.grid).toEqual(toForecastBundle(all, grid, 2).grid);
    });

    it('moves everything to the shared hours when the grid covers fewer', () => {
      // The grid wind ends an hour before the spot datasets do.
      const all = responses({ gridWind: codedResponse(GRID_WIND_VARS, 2, hourlyTimes(START, 2)) });
      const spots = toSpotForecastBundle(all, 2);
      const complete = withGrid(spots, all, grid, 2);

      expect(spots.times).toHaveLength(3);
      expect(complete).toEqual(toForecastBundle(all, grid, 2));
      expect(complete.times).toEqual([START, START + HOUR]);
      expect(complete.spots.hourCount).toBe(2);
    });

    it('rejects grid responses that do not match the grid', () => {
      const all = responses({ gridWind: codedResponse(GRID_WIND_VARS, 1, times) });
      expect(() => withGrid(toSpotForecastBundle(all, 2), all, grid, 2)).toThrow(/grid wind/);
    });
  });
});
