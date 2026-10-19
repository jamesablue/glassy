import { TestBed, type ComponentFixture } from '@angular/core/testing';
import {
  RECORDED_MORNING,
  RECORDED_MORNING_HOUR,
  recordedForecastBundle,
} from '../../../testing/forecast-bundle';
import { pointerAt, setHorizontalBox, stubPointerCapture } from '../../../testing/pointer';
import {
  provideScriptedForecast,
  provideTestForecast,
  ScriptedForecastRepository,
} from '../../../testing/state-providers';
import { OAHU_SPOTS } from '../../domain/spots';
import { ConditionsStore, MapUiStore, SettingsStore, TimelineStore } from '../../state';
import { SpotDetailPanelComponent } from './spot-detail-panel.component';

describe('SpotDetailPanelComponent', () => {
  let fixture: ComponentFixture<SpotDetailPanelComponent>;
  let element: HTMLElement;
  let restorePointerCapture: () => void;

  beforeEach(() => {
    localStorage.clear();
    restorePointerCapture = stubPointerCapture();
  });

  afterEach(() => restorePointerCapture());

  async function render(spotId = 'hanauma'): Promise<void> {
    TestBed.configureTestingModule({
      providers: provideTestForecast(recordedForecastBundle(), RECORDED_MORNING),
    });
    TestBed.inject(MapUiStore).selectSpot(spotId);
    fixture = TestBed.createComponent(SpotDetailPanelComponent);
    element = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
  }

  const stable = (): Promise<void> => fixture.whenStable();
  const text = (selector: string): string =>
    element.querySelector(selector)?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  const cell = (label: string): string => {
    const stat = Array.from(element.querySelectorAll('.stat')).find(
      (candidate) => candidate.querySelector('dt')?.textContent === label,
    );
    return stat?.querySelector('.value')?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  };

  describe('for a selected spot', () => {
    beforeEach(() => render());

    it('names the spot, its region and level', () => {
      expect(text('h2')).toBe('Hanauma Bay');
      expect(text('.meta')).toBe('South Shore · Beginner');
    });

    it('rates the selected hour', () => {
      expect(text('glassy-rating-badge')).toBe('Excellent');
      expect(text('.score')).toBe('8.3/10');
      expect(text('.rating-row .time')).toBe('Sun 8 AM');
    });

    it('notes when the selected hour is after dark', async () => {
      TestBed.inject(TimelineStore).seek(2);
      await stable();
      expect(text('.rating-row .time')).toBe('Sun 2 AM after dark');
    });

    it('lists the conditions, the trend for every hour, the best window and the notes', () => {
      expect(element.querySelectorAll('.stat')).toHaveLength(9);
      expect(cell('Wind')).toBe('17 kt');
      expect(element.querySelectorAll('rect.bar')).toHaveLength(48);
      expect(text('.trend-title')).toBe('Next 2 days bars = snorkel score · line = surf');
      expect(text('glassy-best-window')).toMatch(/^Best daylight window: Mon 1 PM–4 PM · score/);
      expect(text('.notes')).toBe(OAHU_SPOTS.find((spot) => spot.id === 'hanauma')?.notes);
    });

    it('follows the unit settings', async () => {
      const settings = TestBed.inject(SettingsStore);
      settings.setUnit('speed', 'ms');
      settings.setUnit('height', 'm');
      settings.setUnit('temperature', 'c');
      await stable();
      expect(cell('Wind')).toBe('9 m/s');
      expect(cell('Water temp')).toMatch(/^\d+\.\d°C$/);
      expect(text('.surf-max')).toMatch(/^surf max \d\.\d m$/);
    });

    it('moves the timeline to the hour picked on the chart', () => {
      const plot = element.querySelector('.plot') as HTMLElement;
      setHorizontalBox(plot, 0, 480);
      pointerAt(plot, 'pointerdown', 305);
      expect(TestBed.inject(TimelineStore).selectedHour()).toBe(30);
    });

    it('goes back to the list', () => {
      element.querySelector<HTMLButtonElement>('.back')?.click();
      expect(TestBed.inject(MapUiStore).selectedSpotId()).toBeNull();
    });

    it('starts keyboard users at the back button', () => {
      const back = element.querySelector('.back');
      expect(back?.getAttribute('aria-label')).toBe('Back to list');
      expect(document.activeElement).toBe(back);
    });
  });

  it('warns about the hazards at the selected hour', async () => {
    await render();
    const conditions = TestBed.inject(ConditionsStore);
    const mapUi = TestBed.inject(MapUiStore);
    const hazardous = OAHU_SPOTS.find((spot) => {
      mapUi.selectSpot(spot.id);
      return (conditions.selectedSpotDetail()?.hazards.length ?? 0) > 0;
    });
    if (!hazardous) throw new Error('The recording has no hazards at 8 AM');
    await stable();

    const hazards = conditions.selectedSpotDetail()?.hazards ?? [];
    expect(element.querySelectorAll('.warn p')).toHaveLength(hazards.length);
    expect(text('h2')).toBe(hazardous.name);
    expect(RECORDED_MORNING_HOUR).toBe(TestBed.inject(TimelineStore).selectedHour());
  });

  it('leaves focus where it is when the spot was opened from its pin', async () => {
    const pin = document.createElement('button');
    document.body.append(pin);
    pin.focus();
    await render();
    expect(document.activeElement).toBe(pin);
    pin.remove();
  });

  it('waits for the forecast', () => {
    TestBed.configureTestingModule({
      providers: provideScriptedForecast(new ScriptedForecastRepository(), RECORDED_MORNING),
    });
    TestBed.inject(MapUiStore).selectSpot('kuilima');
    fixture = TestBed.createComponent(SpotDetailPanelComponent);
    element = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
    expect(text('h2')).toBe('Kuilima Cove (Turtle Bay)');
    expect(text('.waiting')).toBe('Conditions appear here once the forecast loads.');
  });
});
