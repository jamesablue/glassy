import type { Spot, SpotHourSample, WaveComponent } from '../app/domain/models';

/** A wave component the model has no data for. */
export const NO_WAVES: WaveComponent = { height: NaN, period: NaN, direction: NaN };

/** A south-facing, fully exposed test spot. */
export function testSpot(overrides: Partial<Spot> = {}): Spot {
  return {
    id: 'test-cove',
    name: 'Test Cove',
    region: 'South Shore',
    lat: 21.27,
    lon: -157.75,
    facing: 180,
    window: 80,
    shelter: 0,
    level: 'Beginner',
    notes: 'A spot that only exists in tests.',
    ...overrides,
  };
}

/** A flat, windless daytime hour with no waves in the model. */
export function calmSample(overrides: Partial<SpotHourSample> = {}): SpotHourSample {
  return {
    primarySwell: NO_WAVES,
    secondarySwell: NO_WAVES,
    windWaves: NO_WAVES,
    windSpeed: 0,
    windDirection: 0,
    windGust: 0,
    currentSpeed: 0,
    currentDirection: 0,
    seaSurfaceTemperature: 26,
    seaLevel: 0.1,
    seaLevelNextHour: 0.15,
    rainChance: 10,
    isDay: true,
    ...overrides,
  };
}
