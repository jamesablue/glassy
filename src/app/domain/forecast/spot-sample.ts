import { valueAt } from '../math/value-at';
import type { SpotForecast, SpotHourSample, SpotVariable } from '../models';

/**
 * Reads one spot's forecast for one hour out of the packed series.
 *
 * @throws RangeError when the spot or hour is outside the forecast
 */
export function sampleSpot(
  forecast: SpotForecast,
  spotIndex: number,
  hour: number,
): SpotHourSample {
  const { spotCount, hourCount, series } = forecast;
  if (!(spotIndex >= 0 && spotIndex < spotCount && hour >= 0 && hour < hourCount)) {
    throw new RangeError(
      `No forecast for spot ${spotIndex} at hour ${hour} (${spotCount} spots × ${hourCount} hours)`,
    );
  }
  const index = hour * spotCount + spotIndex;
  const read = (variable: SpotVariable): number => valueAt(series[variable], index);

  return {
    primarySwell: {
      height: read('swellHeight'),
      period: read('swellPeriod'),
      direction: read('swellDirection'),
    },
    secondarySwell: {
      height: read('secondarySwellHeight'),
      period: read('secondarySwellPeriod'),
      direction: read('secondarySwellDirection'),
    },
    windWaves: {
      height: read('windWaveHeight'),
      period: read('windWavePeriod'),
      direction: read('windWaveDirection'),
    },
    windSpeed: read('windSpeed'),
    windDirection: read('windDirection'),
    windGust: read('windGust'),
    currentSpeed: read('currentSpeed'),
    currentDirection: read('currentDirection'),
    seaSurfaceTemperature: read('seaSurfaceTemperature'),
    seaLevel: read('seaLevel'),
    seaLevelNextHour: hour + 1 < hourCount ? valueAt(series.seaLevel, index + spotCount) : NaN,
    rainChance: read('rainChance'),
    isDay: read('isDay') > 0.5,
  };
}
