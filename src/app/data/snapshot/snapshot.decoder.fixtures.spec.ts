import { parseSnapshot } from '@glassy/shared';
import gridMarine from '../../../testing/fixtures/raw/open-meteo-grid-marine.json';
import gridWind from '../../../testing/fixtures/raw/open-meteo-grid-wind.json';
import spotMarine from '../../../testing/fixtures/raw/open-meteo-spot-marine.json';
import spotWeather from '../../../testing/fixtures/raw/open-meteo-spot-weather.json';
import snapshotJson from '../../../testing/fixtures/forecast-snapshot.json';
import { DEFAULT_GLASSY_CONFIG } from '../../core/glassy-config';
import { OAHU_SPOTS } from '../../domain/spots';
import { toForecastBundle } from '../open-meteo/open-meteo.adapter';
import { decodeSnapshot } from './snapshot.decoder';

/**
 * `forecast-snapshot.json` is the snapshot the backend builds from the recorded responses (a
 * backend test keeps it in step). Decoding it must give exactly the bundle the app builds from
 * those responses today, so switching the app to the snapshot changes no score, layer or particle.
 */
describe('decodeSnapshot with the recorded snapshot', () => {
  const grid = DEFAULT_GLASSY_CONFIG.grid;
  const decoded = decodeSnapshot(parseSnapshot(snapshotJson, { spots: OAHU_SPOTS, grid }));
  const direct = toForecastBundle(
    { gridMarine, gridWind, spotMarine, spotWeather },
    grid,
    OAHU_SPOTS.length,
  );

  it('has the same hours and daylight', () => {
    expect(decoded.times).toEqual(direct.times);
    expect(decoded.isDay).toEqual(direct.isDay);
  });

  it('has the same spot series', () => {
    expect(decoded.spots).toEqual(direct.spots);
  });

  it('has the same map fields and particle vectors', () => {
    expect(decoded.grid).toEqual(direct.grid);
  });

  it('is the same bundle', () => {
    expect(decoded).toEqual(direct);
  });
});
