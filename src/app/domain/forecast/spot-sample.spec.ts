import { buildSpotForecast } from '../../../testing/spot-forecast';
import { SPOT_VARIABLES, type SpotVariable } from '../models';
import { sampleSpot } from './spot-sample';

describe('sampleSpot', () => {
  // Every value encodes where it came from: variable × 100 + hour × 10 + spot.
  const code = (variable: SpotVariable, spot: number, hour: number): number =>
    SPOT_VARIABLES.indexOf(variable) * 100 + hour * 10 + spot;
  const forecast = buildSpotForecast(3, 4, (variable, spot, hour) =>
    variable === 'isDay' ? Number(hour < 2) : code(variable, spot, hour),
  );

  it('reads every variable for the right spot and hour', () => {
    const sample = sampleSpot(forecast, 2, 1);
    expect(sample).toEqual({
      primarySwell: {
        height: code('swellHeight', 2, 1),
        period: code('swellPeriod', 2, 1),
        direction: code('swellDirection', 2, 1),
      },
      secondarySwell: {
        height: code('secondarySwellHeight', 2, 1),
        period: code('secondarySwellPeriod', 2, 1),
        direction: code('secondarySwellDirection', 2, 1),
      },
      windWaves: {
        height: code('windWaveHeight', 2, 1),
        period: code('windWavePeriod', 2, 1),
        direction: code('windWaveDirection', 2, 1),
      },
      windSpeed: code('windSpeed', 2, 1),
      windDirection: code('windDirection', 2, 1),
      windGust: code('windGust', 2, 1),
      currentSpeed: code('currentSpeed', 2, 1),
      currentDirection: code('currentDirection', 2, 1),
      seaSurfaceTemperature: code('seaSurfaceTemperature', 2, 1),
      seaLevel: code('seaLevel', 2, 1),
      seaLevelNextHour: code('seaLevel', 2, 2),
      rainChance: code('rainChance', 2, 1),
      isDay: true,
    });
  });

  it('reads the daylight flag', () => {
    expect(sampleSpot(forecast, 0, 1).isDay).toBe(true);
    expect(sampleSpot(forecast, 0, 2).isDay).toBe(false);
  });

  it('has no next-hour sea level at the last hour', () => {
    expect(sampleSpot(forecast, 0, 3).seaLevelNextHour).toBeNaN();
  });

  it('passes missing values through as NaN', () => {
    const gappy = buildSpotForecast(1, 1, (variable) => (variable === 'windGust' ? null : 1));
    const sample = sampleSpot(gappy, 0, 0);
    expect(sample.windGust).toBeNaN();
    expect(sample.windSpeed).toBe(1);
  });

  it.each([
    [-1, 0],
    [3, 0],
    [0, -1],
    [0, 4],
  ])('rejects spot %s at hour %s', (spot, hour) => {
    expect(() => sampleSpot(forecast, spot, hour)).toThrow(RangeError);
  });
});
