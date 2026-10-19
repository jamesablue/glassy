import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, type Observable } from 'rxjs';
import land from '../../../testing/fixtures/raw/noaa-identify-land.json';
import noData from '../../../testing/fixtures/raw/noaa-identify-nodata.json';
import ocean from '../../../testing/fixtures/raw/noaa-identify-ocean.json';
import { provideGlassyConfig } from '../../core/glassy-config.token';
import { BathymetryClient } from './bathymetry.client';
import { identifyUrl } from './identify';

describe('BathymetryClient', () => {
  const baseUrl = 'https://example.com/ImageServer';
  let client: BathymetryClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideGlassyConfig({ noaaDemUrl: baseUrl }),
      ],
    });
    client = TestBed.inject(BathymetryClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  /** Subscribes, answers the one request it makes with `respond`, and resolves the value. */
  async function answer(
    elevation: Observable<number>,
    respond: (request: ReturnType<HttpTestingController['expectOne']>) => void,
  ): Promise<number> {
    const value = firstValueFrom(elevation);
    respond(http.expectOne((request) => request.url.startsWith(`${baseUrl}/identify?`)));
    return value;
  }

  it('reads the depth of a point in the water as a negative elevation', async () => {
    const value = await answer(client.elevationAt(21.269, -157.6936), (request) => {
      expect(request.request.url).toBe(identifyUrl(baseUrl, { lat: 21.269, lon: -157.6936 }));
      request.flush(ocean);
    });
    expect(value).toBeCloseTo(-8.50096, 5);
  });

  it('reads the height of a point on land', async () => {
    const value = await answer(client.elevationAt(21.262, -157.8049), (r) => r.flush(land));
    expect(value).toBeCloseTo(63.305, 3);
  });

  it('emits NaN where NOAA has no data', async () => {
    expect(await answer(client.elevationAt(0, -180), (r) => r.flush(noData))).toBeNaN();
  });

  it('looks points up on a 4-decimal grid', async () => {
    await answer(client.elevationAt(21.26904, -157.693649), (request) => {
      expect(request.request.url).toBe(identifyUrl(baseUrl, { lat: 21.269, lon: -157.6936 }));
      request.flush(ocean);
    });
  });

  it('remembers answers for nearby taps, including "no data"', async () => {
    await answer(client.elevationAt(21.269, -157.6936), (r) => r.flush(ocean));
    await answer(client.elevationAt(0, -180), (r) => r.flush(noData));

    expect(await firstValueFrom(client.elevationAt(21.26901, -157.69359))).toBeCloseTo(-8.5, 1);
    expect(await firstValueFrom(client.elevationAt(0, -180))).toBeNaN();
    http.expectNone(() => true);
  });

  it('fails when the lookup fails, and retries on the next tap', async () => {
    const failed = answer(client.elevationAt(21.3, -157.8), (r) =>
      r.flush('Service unavailable', { status: 503, statusText: 'Service Unavailable' }),
    );
    await expect(failed).rejects.toMatchObject({ status: 503 });

    const offline = answer(client.elevationAt(21.3, -157.8), (r) =>
      r.error(new ProgressEvent('error')),
    );
    await expect(offline).rejects.toMatchObject({ status: 0 });

    const retried = await answer(client.elevationAt(21.3, -157.8), (r) => r.flush(ocean));
    expect(retried).toBeCloseTo(-8.5, 1);
  });

  it('fails on the error ArcGIS reports with HTTP 200, and does not remember it', async () => {
    const errorBody = answer(client.elevationAt(21.3, -157.8), (r) =>
      r.flush({ error: { code: 400, message: 'Unable to complete operation.' } }),
    );
    await expect(errorBody).rejects.toThrow('Unable to complete operation.');

    const empty = answer(client.elevationAt(21.3, -157.8), (r) => r.flush({}));
    await expect(empty).rejects.toThrow('NOAA did not return an elevation');
  });

  it('forgets the oldest points once it has remembered enough', async () => {
    for (let i = 0; i <= 256; i++) {
      await answer(client.elevationAt(20 + i / 1000, -157), (r) => r.flush(ocean));
    }
    // The second point is still known; the first was evicted and is asked for again.
    expect(await firstValueFrom(client.elevationAt(20.001, -157))).toBeCloseTo(-8.5, 1);
    http.expectNone(() => true);
    await answer(client.elevationAt(20, -157), (r) => r.flush(land));
  });
});
