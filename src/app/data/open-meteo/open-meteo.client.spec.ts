import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { testSpot } from '../../../testing/domain-builders';
import {
  codedResponse,
  hourlyTimes,
  openMeteoLocation,
} from '../../../testing/open-meteo-builders';
import { DEFAULT_GLASSY_CONFIG } from '../../core/glassy-config';
import { provideGlassyConfig } from '../../core/glassy-config.token';
import { SPOT_CATALOG } from '../../core/spot-catalog.token';
import type { GridSpec } from '../../domain/models';
import { OpenMeteoClient } from './open-meteo.client';
import { forecastRequestUrls, GRID_MARINE_VARS } from './open-meteo.urls';

describe('OpenMeteoClient', () => {
  const grid: GridSpec = { lat0: 21, lon0: -158, step: 0.125, rows: 1, cols: 2 };
  const spots = [testSpot({ id: 'a' }), testSpot({ id: 'b', lat: 21.65, facing: 300 })];
  const settings = { ...DEFAULT_GLASSY_CONFIG, grid, forecastDays: 2 };
  const urls = forecastRequestUrls(settings, spots);
  let client: OpenMeteoClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideGlassyConfig({ grid, forecastDays: 2 }),
        { provide: SPOT_CATALOG, useValue: spots },
      ],
    });
    client = TestBed.inject(OpenMeteoClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it.each([
    ['gridMarine', () => client.gridMarine()],
    ['gridWind', () => client.gridWind()],
    ['spotMarine', () => client.spotMarine()],
    ['spotWeather', () => client.spotWeather()],
  ] as const)('requests %s for the configured grid and catalog', async (id, request) => {
    const body = codedResponse(GRID_MARINE_VARS, 2, hourlyTimes(1_800_000_000, 2));
    const response = firstValueFrom(request());

    const pending = http.expectOne(urls[id]);
    expect(pending.request.method).toBe('GET');
    pending.flush(body);
    expect(await response).toEqual(body);
  });

  it('passes a single-location response through as Open-Meteo sends it', async () => {
    const body = openMeteoLocation({ time: [1_800_000_000], wind_speed_10m: [4.2] });
    const response = firstValueFrom(client.spotWeather());
    http.expectOne(urls.spotWeather).flush(body);
    expect(await response).toEqual(body);
  });
});
