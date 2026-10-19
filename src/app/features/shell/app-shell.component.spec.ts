import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
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
import { ForecastStore, MapUiStore, SettingsStore, TimelineStore } from '../../state';
import { UNITS_POPOVER_ID } from '../settings/units-popover.component';
import { AppShellComponent } from './app-shell.component';
import { NOTICE_AUTO_HIDE_MS } from './forecast-notice';
import { NotificationToastComponent } from './notification-toast.component';

describe('AppShellComponent', () => {
  const bundle = recordedForecastBundle();
  let repository: ScriptedForecastRepository;
  let fake: FakePopover;
  let fixture: ComponentFixture<AppShellComponent>;
  let element: HTMLElement;

  beforeEach(() => {
    localStorage.clear();
    fake = installFakePopover();
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

  describe('loading', () => {
    it('covers the first load', async () => {
      expect(text('glassy-loading-overlay')).toBe('Loading forecast…');
      expect(element.querySelector('glassy-loading-overlay')?.getAttribute('role')).toBe('status');
      await loaded();
      expect(element.querySelector('glassy-loading-overlay')).toBeNull();
    });

    it('keeps the forecast on show while it reloads', async () => {
      await loaded();
      TestBed.inject(ForecastStore).reload();
      TestBed.tick();
      expect(TestBed.inject(ForecastStore).status()).toBe('loading');
      expect(element.querySelector('glassy-loading-overlay')).toBeNull();
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

    it('offers to retry when nothing loads, and retries from the network', async () => {
      repository.fail('unavailable');
      await stable();
      expect(toast()?.getAttribute('role')).toBe('alert');
      expect(text('glassy-notification-toast')).toBe(
        "Couldn't load the forecast. Check your connection and try again. Retry",
      );

      toast()?.querySelector('button')?.click();
      fixture.detectChanges();
      expect(repository.requests).toEqual([{}, { force: true }]);
      expect(toast()).toBeNull();

      repository.fail('unavailable');
      await stable();
      expect(toast()).not.toBeNull();
    });

    it('explains a rate limit', async () => {
      repository.fail('rate-limited');
      await stable();
      expect(text('glassy-notification-toast')).toBe(
        'The forecast service is getting too many requests. Try again in a minute. Retry',
      );
    });

    it('stays quiet when the forecast is fresh', async () => {
      await loaded();
      expect(toast()).toBeNull();
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
