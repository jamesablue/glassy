import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { installFakeDialog, type FakeDialog } from '../../../testing/fake-dialog';
import { installFakePopover, type FakePopover } from '../../../testing/fake-popover';
import {
  RECORDED_MORNING,
  RECORDED_MORNING_HOUR,
  recordedForecastBundle,
} from '../../../testing/forecast-bundle';
import {
  provideScriptedForecast,
  ScriptedForecastRepository,
} from '../../../testing/state-providers';
import { AppNotices } from '../../core/app-notices';
import { ForecastStore, MapUiStore, SettingsStore, TimelineStore } from '../../state';
import { UNITS_POPOVER_ID } from '../settings/units-popover.component';
import { AppShellComponent } from './app-shell.component';
import { MAP_OVERLAY_UNAVAILABLE, NOTICE_AUTO_HIDE_MS } from './notices';
import { NotificationToastComponent } from './notification-toast.component';

describe('AppShellComponent', () => {
  const bundle = recordedForecastBundle();
  let repository: ScriptedForecastRepository;
  let fake: FakePopover;
  let dialogs: FakeDialog;
  let fixture: ComponentFixture<AppShellComponent>;
  let element: HTMLElement;

  beforeEach(() => {
    localStorage.clear();
    fake = installFakePopover();
    dialogs = installFakeDialog();
    repository = new ScriptedForecastRepository();
    TestBed.configureTestingModule({
      providers: provideScriptedForecast(repository, RECORDED_MORNING),
    });
    fixture = TestBed.createComponent(AppShellComponent);
    element = fixture.nativeElement as HTMLElement;
    // Renders and starts the first load, which waits for the test to answer it.
    TestBed.tick();
  });

  afterEach(() => {
    TestBed.inject(TimelineStore).pause();
    fake.restore();
    dialogs.restore();
  });

  /** Answers the first load with the recorded forecast. */
  async function loaded(): Promise<void> {
    repository.succeed(bundle, RECORDED_MORNING);
    await fixture.whenStable();
  }

  const stable = (): Promise<void> => fixture.whenStable();
  const text = (selector: string): string =>
    element.querySelector(selector)?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  const toast = (): HTMLElement | null => element.querySelector('glassy-notification-toast');
  const press = (key: string, target: Element = document.body): void => {
    target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
    TestBed.tick();
  };

  it('lays out the brand, ranking, layer menu, popovers, legend and timeline', async () => {
    await loaded();
    expect(text('h1')).toBe('Glassy');
    expect(element.querySelector('glassy-panel.side glassy-spot-ranking-panel')).not.toBeNull();
    expect(element.querySelector('glassy-layer-menu nav')).not.toBeNull();
    expect(element.querySelector(`#${UNITS_POPOVER_ID}`)).not.toBeNull();
    expect(text('glassy-legend .unit')).toBe('ft');
    expect(element.querySelector('glassy-timeline [role="slider"]')).not.toBeNull();
  });

  it('puts everything in a named landmark, in the order Tab visits them', async () => {
    await loaded();
    const landmarks = Array.from(
      element.querySelectorAll('header, nav, [role="complementary"], [role="region"]'),
      (landmark) => landmark.getAttribute('aria-label') ?? landmark.tagName.toLowerCase(),
    );
    expect(landmarks).toEqual([
      'header',
      'Snorkel spots',
      'Map controls',
      'Map colours, ft',
      'Forecast timeline',
    ]);
  });

  describe('loading', () => {
    it('covers the first load', async () => {
      expect(text('glassy-loading-overlay')).toBe('Loading forecast…');
      expect(element.querySelector('glassy-loading-overlay')?.getAttribute('role')).toBe('status');
      await loaded();
      expect(element.querySelector('glassy-loading-overlay')).toBeNull();
    });

    it('keeps the forecast on show while it reloads, and says so', async () => {
      await loaded();
      TestBed.inject(ForecastStore).reload();
      TestBed.tick();
      expect(TestBed.inject(ForecastStore).status()).toBe('loading');
      expect(element.querySelector('glassy-loading-overlay')).toBeNull();
      expect(text('glassy-notification-toast')).toBe('Refreshing the forecast…');

      repository.succeed(bundle, RECORDED_MORNING);
      await stable();
      expect(toast()).toBeNull();
    });

    const chip = (): HTMLElement | null => element.querySelector('glassy-map-layers-chip');

    it('shows the spot forecast first, with a chip until the map layers land', async () => {
      repository.serveSpots(bundle, RECORDED_MORNING);
      await stable();
      expect(element.querySelector('glassy-loading-overlay')).toBeNull();
      expect(element.querySelectorAll('glassy-spot-ranking-row')).toHaveLength(
        bundle.spots.spotCount,
      );
      expect(chip()?.getAttribute('role')).toBe('status');
      expect(text('glassy-map-layers-chip')).toBe('Loading map layers…');
      expect(toast()).toBeNull();

      repository.succeed(bundle, RECORDED_MORNING);
      await stable();
      expect(chip()).toBeNull();
      expect(toast()).toBeNull();
    });

    it('keeps the spot forecast and says so politely when the map layers fail', async () => {
      repository.serveSpots(bundle, RECORDED_MORNING);
      await stable();
      repository.failGrid(bundle, RECORDED_MORNING);
      await stable();

      expect(chip()).toBeNull();
      expect(toast()?.getAttribute('role')).toBe('status');
      expect(text('glassy-notification-toast')).toBe(MAP_OVERLAY_UNAVAILABLE);
      expect(element.querySelectorAll('glassy-spot-ranking-row')).toHaveLength(
        bundle.spots.spotCount,
      );
    });

    it('shows an older cached forecast at once while it refreshes', async () => {
      repository.serveStaleWhileRefreshing(bundle, Date.UTC(2026, 9, 18, 17));
      await stable();
      expect(element.querySelector('glassy-loading-overlay')).toBeNull();
      expect(chip()).toBeNull();
      expect(text('glassy-notification-toast')).toBe('Refreshing the forecast…');
      expect(text('.data-age')).toBe('Data from Sun 7 AM');

      repository.succeed(bundle, RECORDED_MORNING);
      await stable();
      expect(toast()).toBeNull();
      expect(element.querySelector('.data-age')).toBeNull();
    });
  });

  describe('notices', () => {
    it('says a stale forecast is shown, then lets it go', async () => {
      repository.serveStale(bundle, Date.UTC(2026, 9, 18, 17));
      await stable();
      expect(toast()?.getAttribute('role')).toBe('status');
      expect(text('glassy-notification-toast')).toBe(
        "Couldn't refresh the forecast. Showing data from Sun 7 AM.",
      );

      // The toast times itself (see its own spec); here, the shell lets go when it asks.
      const notice = fixture.debugElement.query(By.directive(NotificationToastComponent))
        .componentInstance as NotificationToastComponent;
      expect(notice.autoHideMs()).toBe(NOTICE_AUTO_HIDE_MS);
      notice.dismiss.emit();
      TestBed.tick();
      expect(toast()).toBeNull();
    });

    const loadError = (): HTMLDialogElement | null =>
      element.querySelector('glassy-load-error dialog');

    it('fills the screen when nothing loads, and retries from the network', async () => {
      repository.fail('unavailable');
      await stable();
      expect(loadError()?.hasAttribute('open')).toBe(true);
      expect(loadError()?.getAttribute('role')).toBe('alertdialog');
      expect(text('glassy-load-error h2')).toBe("Couldn't load the forecast");
      expect(text('glassy-load-error p')).toBe('Check your connection and try again.');
      expect(toast()).toBeNull();

      loadError()?.querySelector('button')?.click();
      fixture.detectChanges();
      expect(repository.requests).toEqual([{}, { force: true }]);
      expect(loadError()).toBeNull();
      expect(element.querySelector('glassy-loading-overlay')).not.toBeNull();

      repository.fail('unavailable');
      await stable();
      expect(loadError()).not.toBeNull();

      loadError()?.querySelector('button')?.click();
      TestBed.tick();
      await loaded();
      expect(loadError()).toBeNull();
      expect(toast()).toBeNull();
    });

    it('explains a rate limit', async () => {
      repository.fail('rate-limited');
      await stable();
      expect(text('glassy-load-error h2')).toBe('The forecast service is busy');
      expect(text('glassy-load-error p')).toBe(
        'Open-Meteo is getting too many requests right now. Try again in a minute.',
      );
    });

    it('leaves the error as a toast with Retry once the screen is closed with Escape', async () => {
      repository.fail('unavailable');
      await stable();
      press('Escape');
      await stable();

      expect(loadError()).toBeNull();
      expect(toast()?.getAttribute('role')).toBe('alert');
      expect(text('glassy-notification-toast')).toBe(
        "Couldn't load the forecast. Check your connection and try again. Retry",
      );
      toast()?.querySelector('button')?.click();
      fixture.detectChanges();
      expect(repository.requests).toEqual([{}, { force: true }]);
    });

    describe('offline', () => {
      let onLine: ReturnType<typeof vi.spyOn>;

      beforeEach(() => {
        onLine = vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(true);
      });

      afterEach(() => onLine.mockRestore());

      /** The browser loses its connection or gets it back. A reload it starts is left waiting. */
      const connection = (online: boolean): void => {
        onLine.mockReturnValue(online);
        window.dispatchEvent(new Event(online ? 'online' : 'offline'));
        TestBed.tick();
      };

      it('says the forecast loads once the connection is back, and loads it then', async () => {
        connection(false);
        repository.fail('unavailable');
        await stable();
        expect(text('glassy-load-error h2')).toBe("You're offline");

        connection(true);
        expect(repository.requests).toEqual([{}, { force: true }]);
        expect(loadError()).toBeNull();
      });

      it('says the forecast on show is all there is until then', async () => {
        await loaded();
        connection(false);
        expect(text('glassy-notification-toast')).toBe(
          "You're offline. Showing the forecast from Sun 8 AM; it refreshes when you're back online.",
        );
        connection(true);
        expect(toast()).toBeNull();
      });
    });

    it('stays quiet when the forecast is fresh', async () => {
      await loaded();
      expect(toast()).toBeNull();
    });

    describe('reported problems', () => {
      beforeEach(loaded);

      it('says map tiles are missing, politely, and lets it go', async () => {
        TestBed.inject(AppNotices).raise('map-tiles-unavailable');
        await stable();
        expect(toast()?.getAttribute('role')).toBe('status');
        expect(text('glassy-notification-toast')).toBe(
          "Map tiles aren't loading right now. The forecast still works.",
        );

        const notice = fixture.debugElement.query(By.directive(NotificationToastComponent))
          .componentInstance as NotificationToastComponent;
        notice.dismiss.emit();
        await stable();
        expect(toast()).toBeNull();
      });

      it('owns up to an unexpected error', async () => {
        TestBed.inject(AppNotices).raise('unexpected-error');
        await stable();
        expect(text('glassy-notification-toast')).toBe(
          'Something went wrong. If the map stops responding, reload the page.',
        );
      });

      it('lets the forecast speak first', async () => {
        TestBed.inject(AppNotices).raise('map-tiles-unavailable');
        TestBed.inject(ForecastStore).reload();
        TestBed.tick();
        expect(text('glassy-notification-toast')).toBe('Refreshing the forecast…');

        repository.succeed(bundle, RECORDED_MORNING);
        await stable();
        expect(text('glassy-notification-toast')).toBe(
          "Map tiles aren't loading right now. The forecast still works.",
        );
      });
    });
  });

  describe('spot details', () => {
    beforeEach(loaded);

    it('swaps the ranking for the selected spot’s details, loaded on demand', async () => {
      expect(element.querySelector('glassy-spot-detail-panel')).toBeNull();
      TestBed.inject(MapUiStore).selectSpot('hanauma');
      await stable();
      expect(element.querySelector('glassy-spot-ranking-panel')?.hasAttribute('hidden')).toBe(true);
      expect(text('glassy-spot-detail-panel h2')).toBe('Hanauma Bay');

      element.querySelector<HTMLButtonElement>('glassy-spot-detail-panel .back')?.click();
      await stable();
      expect(element.querySelector('glassy-spot-detail-panel')).toBeNull();
      expect(element.querySelector('glassy-spot-ranking-panel')?.hasAttribute('hidden')).toBe(
        false,
      );
    });

    it('shows the new units everywhere at once', async () => {
      TestBed.inject(MapUiStore).selectSpot('hanauma');
      await stable();
      const units = TestBed.inject(SettingsStore);
      units.setUnit('height', 'm');
      units.setUnit('speed', 'kmh');
      await stable();

      const hanaumaRow = Array.from(element.querySelectorAll('glassy-spot-ranking-row')).find(
        (row) => row.querySelector('.name')?.textContent === 'Hanauma Bay',
      );
      expect(hanaumaRow?.querySelector('.sub')?.textContent).toContain('km/h');
      expect(hanaumaRow?.querySelector('.sub')?.textContent).toMatch(/\d\.\d–\d\.\d m/);
      expect(text('glassy-spot-detail-panel .stat .value')).toMatch(/ m$/);
      expect(text('glassy-spot-detail-panel .surf-max')).toMatch(/ m$/);
      expect(text('glassy-legend .unit')).toBe('m');

      TestBed.inject(MapUiStore).setLayer('wind');
      await stable();
      expect(text('glassy-legend .unit')).toBe('km/h');
    });
  });

  describe('keyboard', () => {
    beforeEach(loaded);

    it('steps the hour with the arrow keys and plays with Space', async () => {
      const timeline = TestBed.inject(TimelineStore);
      press('ArrowRight');
      press('ArrowRight');
      press('ArrowLeft');
      expect(timeline.selectedHour()).toBe(RECORDED_MORNING_HOUR + 1);

      press(' ');
      expect(timeline.isPlaying()).toBe(true);
      press(' ');
      expect(timeline.isPlaying()).toBe(false);
    });

    it('leaves the slider’s own keys to it', async () => {
      const slider = element.querySelector('[role="slider"]') as HTMLElement;
      press('ArrowRight', slider);
      expect(TestBed.inject(TimelineStore).selectedHour()).toBe(RECORDED_MORNING_HOUR + 1);
    });

    it('closes the spot details with Escape', async () => {
      const mapUi = TestBed.inject(MapUiStore);
      mapUi.selectSpot('kuilima');
      await stable();
      press('Escape');
      expect(mapUi.selectedSpotId()).toBeNull();
    });

    it('lets Escape close the point readout before the details', async () => {
      const mapUi = TestBed.inject(MapUiStore);
      mapUi.selectSpot('kuilima');
      mapUi.inspect({ lat: 21.3, lon: -157.9 });
      await stable();

      press('Escape');
      expect(mapUi.inspectedPoint()).toBeNull();
      expect(mapUi.selectedSpotId()).toBe('kuilima');
      press('Escape');
      expect(mapUi.selectedSpotId()).toBeNull();
    });

    it('lets Escape close an open popover first', async () => {
      const mapUi = TestBed.inject(MapUiStore);
      mapUi.selectSpot('kuilima');
      await stable();
      const units = element.querySelector<HTMLElement>(`#${UNITS_POPOVER_ID}`);
      units?.showPopover();
      await stable();

      press('Escape');
      expect(units && fake.isOpen(units)).toBe(false);
      expect(mapUi.selectedSpotId()).toBe('kuilima');

      press('Escape');
      expect(mapUi.selectedSpotId()).toBeNull();
    });
  });

  it('ignores the timeline keys until the forecast loads, but still closes details', async () => {
    const mapUi = TestBed.inject(MapUiStore);
    mapUi.selectSpot('kuilima');
    press('ArrowRight');
    press(' ');
    expect(TestBed.inject(TimelineStore).isPlaying()).toBe(false);
    press('Escape');
    expect(mapUi.selectedSpotId()).toBeNull();
  });
});
