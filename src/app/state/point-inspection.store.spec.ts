import { TestBed } from '@angular/core/testing';
import { NEVER, of, Subject, throwError, type Observable } from 'rxjs';
import { testForecastBundle } from '../../testing/forecast-bundle';
import { provideTestForecast } from '../../testing/state-providers';
import { BathymetryClient } from '../data/noaa/bathymetry.client';
import { samplePoint, toVectorField } from '../domain/grid';
import type { ForecastBundle, GridSpec } from '../domain/models';
import { MapUiStore } from './map-ui.store';
import { PointInspectionStore } from './point-inspection.store';
import { TimelineStore } from './timeline.store';

/** Two hours on a 2 × 2 grid around 21.0625°N 157.9375°W, with wave heights that grow each hour. */
function gridBundle(): ForecastBundle {
  const base = testForecastBundle(2);
  const spec: GridSpec = { lat0: 21, lon0: -158, step: 0.125, rows: 2, cols: 2 };
  const field = (first: number, second: number): Float32Array =>
    Float32Array.of(first, first, first, first, second, second, second, second);
  return {
    ...base,
    grid: {
      spec,
      fields: {
        windSpeed: field(5, 6),
        waveHeight: field(1, 2),
        wavePeriod: field(8, 9),
        swellHeight: field(0.5, 0.75),
        swellPeriod: field(12, 13),
      },
      vectors: {
        wind: toVectorField(field(5, 6), field(70, 70)),
        waves: toVectorField(field(8, 9), field(180, 180)),
        swell: toVectorField(field(12, 13), field(200, 200)),
      },
    },
  };
}

describe('PointInspectionStore', () => {
  const NOW = 1_800_000_000 * 1000;
  const INSIDE = { lat: 21.06, lon: -157.94 };
  const bundle = gridBundle();
  const elevationAt = vi.fn<(lat: number, lon: number) => Observable<number>>();
  let store: PointInspectionStore;
  let mapUi: MapUiStore;

  beforeEach(() => {
    localStorage.clear();
    elevationAt.mockReset().mockReturnValue(NEVER);
    TestBed.configureTestingModule({
      providers: [
        ...provideTestForecast(bundle, NOW),
        { provide: BathymetryClient, useValue: { elevationAt } },
      ],
    });
    store = TestBed.inject(PointInspectionStore);
    mapUi = TestBed.inject(MapUiStore);
  });

  /**
   * Lets the forecast load and effects run. A lookup that never answers stays pending, so this
   * cannot wait for the app to become stable.
   */
  async function settle(): Promise<void> {
    TestBed.tick();
    await new Promise((resolve) => setTimeout(resolve));
    TestBed.tick();
  }

  it('has nothing to show until a point is inspected', async () => {
    await settle();
    expect(store.reading()).toBeNull();
    expect(store.elevation()).toBeNull();
    expect(store.forecast()).toBeNull();
    expect(elevationAt).not.toHaveBeenCalled();
  });

  describe('elevation', () => {
    it('is loading while NOAA has not answered', async () => {
      mapUi.inspect(INSIDE);
      await settle();
      expect(elevationAt).toHaveBeenCalledWith(INSIDE.lat, INSIDE.lon);
      expect(store.elevation()).toEqual({ status: 'loading' });
    });

    it('reads a depth as a negative elevation', async () => {
      elevationAt.mockReturnValue(of(-8.5));
      mapUi.inspect(INSIDE);
      await settle();
      expect(store.elevation()).toEqual({ status: 'ready', meters: -8.5 });
    });

    it('reports no data where NOAA has none', async () => {
      elevationAt.mockReturnValue(of(NaN));
      mapUi.inspect(INSIDE);
      await settle();
      expect(store.elevation()).toEqual({ status: 'no-data' });
    });

    it('reports an error when the lookup fails', async () => {
      elevationAt.mockReturnValue(throwError(() => new Error('offline')));
      mapUi.inspect(INSIDE);
      await settle();
      expect(store.elevation()).toEqual({ status: 'error' });
    });

    it('ignores a late answer for a point that is no longer inspected', async () => {
      const first = new Subject<number>();
      elevationAt.mockReturnValueOnce(first).mockReturnValueOnce(of(-30));
      mapUi.inspect(INSIDE);
      await settle();
      mapUi.inspect({ lat: 21.1, lon: -157.9 });
      await settle();

      first.next(-2);
      await settle();
      expect(store.elevation()).toEqual({ status: 'ready', meters: -30 });
      expect(first.observed).toBe(false);
    });

    it('ignores an answer that arrives after the inspection is cleared', async () => {
      const lookup = new Subject<number>();
      elevationAt.mockReturnValueOnce(lookup).mockReturnValueOnce(NEVER);
      mapUi.inspect(INSIDE);
      await settle();
      mapUi.clearInspection();
      await settle();

      lookup.next(-2);
      await settle();
      expect(store.elevation()).toBeNull();

      mapUi.inspect(INSIDE);
      await settle();
      expect(store.elevation()).toEqual({ status: 'loading' });
    });
  });

  describe('forecast', () => {
    it('samples the grid at the point for the selected hour', async () => {
      mapUi.inspect(INSIDE);
      await settle();
      const hour = TestBed.inject(TimelineStore).selectedHour();
      expect(store.forecast()).toEqual({
        status: 'ready',
        sample: samplePoint(bundle.grid, hour, INSIDE.lat, INSIDE.lon),
      });
    });

    it('follows the timeline', async () => {
      mapUi.inspect(INSIDE);
      await settle();
      const timeline = TestBed.inject(TimelineStore);
      timeline.seek(0);
      const first = store.forecast();
      timeline.seek(1);
      const second = store.forecast();
      expect(first?.status === 'ready' && first.sample.waveHeight).toBeCloseTo(1, 5);
      expect(second?.status === 'ready' && second.sample.waveHeight).toBeCloseTo(2, 5);
    });

    it('has no forecast off the grid', async () => {
      mapUi.inspect({ lat: 23, lon: -157.94 });
      await settle();
      expect(store.forecast()).toEqual({ status: 'outside' });
    });

    it('waits for the forecast to load', () => {
      mapUi.inspect(INSIDE);
      expect(store.forecast()).toEqual({ status: 'loading' });
    });
  });

  it('puts the point, hour, forecast and elevation together for the readout', async () => {
    elevationAt.mockReturnValue(of(12));
    mapUi.inspect(INSIDE);
    await settle();
    const timeline = TestBed.inject(TimelineStore);
    expect(store.reading()).toEqual({
      point: INSIDE,
      time: timeline.selectedTime(),
      forecast: store.forecast(),
      elevation: { status: 'ready', meters: 12 },
    });
  });
});
