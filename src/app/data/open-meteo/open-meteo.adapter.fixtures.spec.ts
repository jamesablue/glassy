import expected from '../../../testing/fixtures/spot-forecast.expected.json';
import spotFixture from '../../../testing/fixtures/spot-forecast.fixture.json';
import manifest from '../../../testing/fixtures/raw/manifest.json';
import gridMarine from '../../../testing/fixtures/raw/open-meteo-grid-marine.json';
import gridWind from '../../../testing/fixtures/raw/open-meteo-grid-wind.json';
import spotMarine from '../../../testing/fixtures/raw/open-meteo-spot-marine.json';
import spotWeather from '../../../testing/fixtures/raw/open-meteo-spot-weather.json';
import { spotForecastFromFixture } from '../../../testing/spot-forecast';
import { DEFAULT_GLASSY_CONFIG } from '../../core/glassy-config';
import { samplePoint } from '../../domain/grid';
import { computeScoreMatrix, rankSpots } from '../../domain/scoring';
import { OAHU_SPOTS } from '../../domain/spots';
import { toForecastBundle } from './open-meteo.adapter';
import { forecastRequestUrls } from './open-meteo.urls';

/**
 * Real responses recorded in the same run as the golden scoring fixture
 * (scripts/record-fixtures.ts). The adapter must unpack exactly the spot series the recorder wrote
 * independently, which makes the golden test's scores hold for the app's own data path too.
 */
describe('toForecastBundle with recorded responses', () => {
  const bundle = toForecastBundle(
    { gridMarine, gridWind, spotMarine, spotWeather },
    DEFAULT_GLASSY_CONFIG.grid,
    OAHU_SPOTS.length,
  );

  it('was recorded with the requests the app makes today', () => {
    const urls = forecastRequestUrls(DEFAULT_GLASSY_CONFIG, OAHU_SPOTS);
    expect(manifest.openMeteo.requests.gridMarine.url).toBe(urls.gridMarine);
    expect(manifest.openMeteo.requests.gridWind.url).toBe(urls.gridWind);
    expect(manifest.openMeteo.requests.spotMarine.url).toBe(urls.spotMarine);
    expect(manifest.openMeteo.requests.spotWeather.url).toBe(urls.spotWeather);
    expect(manifest.recordedAt).toBe(spotFixture.recordedAt);
  });

  it('covers the recorded hours', () => {
    expect(bundle.times).toEqual(spotFixture.times);
    expect(bundle.isDay).toHaveLength(manifest.hours);
    expect(bundle.isDay).toContain(true);
    expect(bundle.isDay).toContain(false);
  });

  it('unpacks the same spot series as the golden fixture', () => {
    expect(bundle.spots).toEqual(spotForecastFromFixture(spotFixture));
  });

  it('scores and ranks every hour like the original prototype', () => {
    const matrix = computeScoreMatrix(OAHU_SPOTS, bundle.spots);
    const rankings = bundle.times.map((_, hour) =>
      rankSpots(matrix, hour).map((index) => OAHU_SPOTS[index]?.id),
    );
    expect(rankings).toEqual(expected.rankings);
  });

  it('fills the map grid around the island', () => {
    const cells = DEFAULT_GLASSY_CONFIG.grid.rows * DEFAULT_GLASSY_CONFIG.grid.cols;
    expect(bundle.grid.fields.windSpeed).toHaveLength(cells * manifest.hours);
    // Off Waikiki: open water with both models covering it.
    const sample = samplePoint(bundle.grid, 0, 21.2, -157.85);
    expect(sample?.windSpeed).toBeGreaterThan(0);
    expect(sample?.waveHeight).toBeGreaterThan(0);
    expect(sample?.swellPeriod).toBeGreaterThan(0);
  });
});
