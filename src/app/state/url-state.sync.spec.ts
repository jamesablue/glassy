import { Location } from '@angular/common';
import { SpyLocation } from '@angular/common/testing';
import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, Subject } from 'rxjs';
import { recordedForecastBundle } from '../../testing/forecast-bundle';
import { FakeClock, spotHalf } from '../../testing/state-providers';
import { CLOCK } from '../core/clock';
import {
  ForecastRepository,
  type ForecastResult,
  type FreshForecastResult,
} from '../data/forecast.repository';
import { MapUiStore } from './map-ui.store';
import { PREFERENCES_STORAGE_KEY } from './settings.store';
import { PLAYBACK_INTERVAL_MS, TimelineStore } from './timeline.store';
import { provideUrlStateSync, UrlStateSync } from './url-state.sync';

/** 8:30 AM on the recorded forecast's first day (Sunday 18 October 2026) in Honolulu: hour 8. */
const MORNING = Date.UTC(2026, 9, 18, 18, 30);
const NOW_HOUR = 8;

describe('UrlStateSync', () => {
  const result: FreshForecastResult = {
    bundle: recordedForecastBundle(),
    fetchedAt: MORNING,
    source: 'network',
    gridStatus: 'ready',
  };
  /** Set by a test that wants to hold the forecast back; otherwise it loads straight away. */
  let heldForecast: Subject<ForecastResult> | undefined;
  let location: SpyLocation;
  let mapUi: MapUiStore;
  let timeline: TimelineStore;

  beforeEach(() => {
    localStorage.clear();
    heldForecast = undefined;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /** Lets effects run and loads finish. */
  async function settle(): Promise<void> {
    TestBed.tick();
    await TestBed.inject(ApplicationRef).whenStable();
  }

  /**
   * Starts a fresh app on `url`, the way a browser opens a shared link. The URL sync starts the way
   * `app.config.ts` starts it, as the app initializes. Waits for the forecast unless it is held back.
   */
  async function open(url: string): Promise<void> {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideUrlStateSync(),
        {
          provide: Location,
          useFactory: () => {
            const spy = new SpyLocation();
            spy.setInitialPath(url);
            return spy;
          },
        },
        { provide: ForecastRepository, useValue: { load: () => heldForecast ?? of(result) } },
        { provide: CLOCK, useValue: new FakeClock(MORNING) },
      ],
    });
    location = TestBed.inject(Location) as SpyLocation;
    mapUi = TestBed.inject(MapUiStore);
    timeline = TestBed.inject(TimelineStore);
    if (heldForecast) TestBed.tick();
    else await settle();
  }

  const query = (): Record<string, string> =>
    Object.fromEntries(new URLSearchParams(location.path().split('?')[1] ?? ''));

  describe('from the URL', () => {
    it('restores the spot and layer of a shared link', async () => {
      await open('/?spot=hanauma&layer=depth');

      expect(mapUi.selectedSpotId()).toBe('hanauma');
      expect(mapUi.activeLayer()).toBe('depth');
      expect(query()).toEqual({ spot: 'hanauma', layer: 'depth' });
    });

    it('restores the hour', async () => {
      await open('/?t=2026-10-19T06');

      expect(timeline.selectedHour()).toBe(30);
      expect(timeline.isPlaying()).toBe(false);
      expect(query()).toEqual({ t: '2026-10-19T06' });
    });

    it('waits for the forecast before applying the hour, keeping it in the URL', async () => {
      const forecast = new Subject<ForecastResult>();
      heldForecast = forecast;
      await open('/?t=2026-10-19T06');

      expect(timeline.hourCount()).toBe(0);
      expect(location.urlChanges).toEqual([]);

      forecast.next(result);
      forecast.complete();
      await settle();

      expect(timeline.selectedHour()).toBe(30);
      expect(query()).toEqual({ t: '2026-10-19T06' });
    });

    it('applies the hour to the spot forecast, and keeps it when the map grid lands', async () => {
      const forecast = new Subject<ForecastResult>();
      heldForecast = forecast;
      await open('/?t=2026-10-19T06');

      forecast.next({
        source: 'network',
        bundle: spotHalf(result.bundle),
        fetchedAt: MORNING,
        gridStatus: 'loading',
      });
      await settle();
      expect(timeline.selectedHour()).toBe(30);

      forecast.next(result);
      forecast.complete();
      await settle();
      expect(timeline.selectedHour()).toBe(30);
      expect(query()).toEqual({ t: '2026-10-19T06' });
    });

    it.each([
      ['after the forecast ends', '2026-10-25T08', 47, '2026-10-19T23'],
      ['before the forecast starts', '2026-10-01T08', 0, '2026-10-18T00'],
    ])('clamps an hour %s', async (_, t, hour, clamped) => {
      await open(`/?t=${t}`);

      expect(timeline.selectedHour()).toBe(hour);
      expect(query()).toEqual({ t: clamped });
    });

    it('ignores unknown and malformed values and tidies them out of the URL', async () => {
      await open('/?layer=clouds&spot=atlantis&t=yesterday');

      expect(mapUi.activeLayer()).toBe('waves');
      expect(mapUi.selectedSpotId()).toBeNull();
      expect(timeline.selectedHour()).toBe(NOW_HOUR);
      expect(query()).toEqual({});
    });

    it('keeps the viewer’s saved layer when the link has none', async () => {
      localStorage.setItem(
        PREFERENCES_STORAGE_KEY,
        JSON.stringify({ map: { layer: 'wind', particlesOn: true, spotsOn: true } }),
      );

      await open('/?spot=sharks');

      expect(mapUi.activeLayer()).toBe('wind');
      expect(query()).toEqual({ spot: 'sharks', layer: 'wind' });
    });

    it('reads the URL before it writes, so a shared link wins over saved choices', async () => {
      localStorage.setItem(
        PREFERENCES_STORAGE_KEY,
        JSON.stringify({ map: { layer: 'swell', particlesOn: true, spotsOn: true } }),
      );

      await open('/?layer=depth');

      expect(mapUi.activeLayer()).toBe('depth');
      expect(location.urlChanges).toEqual([]);
    });

    it('sends any other path back to the map, keeping its query', async () => {
      await open('/somewhere/else?layer=wind');

      expect(location.path()).toBe('/?layer=wind');
      expect(mapUi.activeLayer()).toBe('wind');
    });

    it('follows later navigations it did not make, such as the back button', async () => {
      await open('/?spot=hanauma');
      location.simulateUrlPop('/?spot=sharks&layer=swell');
      await settle();

      expect(mapUi.selectedSpotId()).toBe('sharks');
      expect(mapUi.activeLayer()).toBe('swell');
    });
  });

  describe('to the URL', () => {
    beforeEach(async () => {
      await open('/');
    });

    it('leaves the URL clean at the default view', () => {
      expect(location.path()).toBe('/');
      expect(location.urlChanges).toEqual([]);
    });

    it('writes the layer, spot and hour as they change', async () => {
      mapUi.setLayer('swell');
      mapUi.selectSpot('hanauma');
      timeline.seek(30);
      await settle();

      expect(query()).toEqual({ layer: 'swell', spot: 'hanauma', t: '2026-10-19T06' });
    });

    it('drops each parameter when it goes back to its default', async () => {
      mapUi.setLayer('swell');
      mapUi.selectSpot('hanauma');
      timeline.seek(30);
      await settle();

      mapUi.setLayer('waves');
      mapUi.clearSelection();
      timeline.goToNow();
      await settle();

      expect(location.path()).toBe('/');
    });

    it('replaces the history entry instead of adding one', async () => {
      for (const hour of [9, 10, 11, 12]) {
        timeline.seek(hour);
        await settle();
      }
      mapUi.setLayer('depth');
      await settle();

      expect(location.urlChanges).toEqual([
        'replace: /?t=2026-10-18T09',
        'replace: /?t=2026-10-18T10',
        'replace: /?t=2026-10-18T11',
        'replace: /?t=2026-10-18T12',
        'replace: /?t=2026-10-18T12&layer=depth',
      ]);
    });

    it('does not read its own writes back, so playback keeps going', async () => {
      vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
      timeline.play();
      vi.advanceTimersByTime(PLAYBACK_INTERVAL_MS);
      await settle();

      expect(query()).toEqual({ t: '2026-10-18T09' });
      expect(timeline.isPlaying()).toBe(true);
      vi.advanceTimersByTime(PLAYBACK_INTERVAL_MS);
      expect(timeline.selectedHour()).toBe(10);
      timeline.pause();
    });
  });

  it('keeps query parameters that belong to someone else', async () => {
    await open('/?ref=newsletter');
    mapUi.setLayer('period');
    await settle();

    expect(query()).toEqual({ ref: 'newsletter', layer: 'period' });
  });

  it('starts only once', async () => {
    await open('/?layer=depth');
    TestBed.inject(UrlStateSync).start();
    mapUi.setLayer('wind');
    await settle();

    expect(location.urlChanges).toEqual(['replace: /?layer=wind']);
  });

  it('stops following the back button when the app is destroyed', async () => {
    await open('/?spot=hanauma');
    const spot = mapUi.selectedSpotId;
    TestBed.resetTestingModule();

    location.simulateUrlPop('/?spot=sharks');
    expect(spot()).toBe('hanauma');
  });
});
