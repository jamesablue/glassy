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
import { TimelineStore } from '../../state';
import { TimelineComponent } from './timeline.component';

describe('TimelineComponent', () => {
  const HOURS = 48;
  let fixture: ComponentFixture<TimelineComponent>;
  let element: HTMLElement;
  let timeline: TimelineStore;
  let restorePointerCapture: () => void;

  beforeEach(async () => {
    restorePointerCapture = stubPointerCapture();
    TestBed.configureTestingModule({
      providers: provideTestForecast(recordedForecastBundle(), RECORDED_MORNING),
    });
    timeline = TestBed.inject(TimelineStore);
    fixture = TestBed.createComponent(TimelineComponent);
    element = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
  });

  afterEach(() => {
    timeline.pause();
    restorePointerCapture();
  });

  const slider = (): HTMLElement => element.querySelector('[role="slider"]') as HTMLElement;
  const button = (name: string): HTMLButtonElement | undefined =>
    Array.from(element.querySelectorAll('button')).find(
      (candidate) =>
        (candidate.getAttribute('aria-label') ?? candidate.textContent?.trim()) === name,
    );

  async function press(key: string): Promise<KeyboardEvent> {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    slider().dispatchEvent(event);
    await fixture.whenStable();
    return event;
  }

  describe('slider', () => {
    it('spans the forecast hours and starts at now', () => {
      expect(slider().getAttribute('aria-label')).toBe('Forecast hour');
      expect(slider().getAttribute('aria-valuemin')).toBe('0');
      expect(slider().getAttribute('aria-valuemax')).toBe(String(HOURS - 1));
      expect(slider().getAttribute('aria-valuenow')).toBe(String(RECORDED_MORNING_HOUR));
      expect(slider().getAttribute('aria-valuetext')).toBe('Sun 8 AM');
      expect(slider().tabIndex).toBe(0);
    });

    it('steps an hour with the arrow keys and says which hour it is', async () => {
      const right = await press('ArrowRight');
      expect(right.defaultPrevented).toBe(true);
      expect(slider().getAttribute('aria-valuenow')).toBe('9');
      expect(slider().getAttribute('aria-valuetext')).toBe('Sun 9 AM');

      await press('ArrowLeft');
      await press('ArrowLeft');
      expect(slider().getAttribute('aria-valuetext')).toBe('Sun 7 AM');
      await press('ArrowUp');
      await press('ArrowDown');
      expect(timeline.selectedHour()).toBe(7);
    });

    it('jumps to the ends with Home and End', async () => {
      await press('End');
      expect(slider().getAttribute('aria-valuetext')).toBe('Mon 11 PM');
      await press('Home');
      expect(slider().getAttribute('aria-valuetext')).toBe('Sun 12 AM');
    });

    it('moves a day with Page Up and Page Down, stopping at the ends', async () => {
      await press('PageUp');
      expect(slider().getAttribute('aria-valuetext')).toBe('Mon 8 AM');
      await press('PageUp');
      expect(timeline.selectedHour()).toBe(HOURS - 1);
      await press('PageDown');
      await press('PageDown');
      expect(timeline.selectedHour()).toBe(0);
    });

    it('leaves other keys to the page', async () => {
      const event = await press('a');
      expect(event.defaultPrevented).toBe(false);
      expect(timeline.selectedHour()).toBe(RECORDED_MORNING_HOUR);
    });

    it('stops playback when moved', async () => {
      timeline.play();
      await press('ArrowRight');
      expect(timeline.isPlaying()).toBe(false);
    });
  });

  describe('dragging', () => {
    beforeEach(() => setHorizontalBox(slider(), 50, 960));

    it('picks the hour under the pointer', async () => {
      pointerAt(slider(), 'pointerdown', 50 + 20 * 30 + 5);
      pointerAt(slider(), 'pointerup', 50 + 20 * 30 + 5);
      await fixture.whenStable();
      expect(timeline.selectedHour()).toBe(30);
      expect(slider().getAttribute('aria-valuetext')).toBe('Mon 6 AM');
    });

    it('follows the pointer while it is down, clamped to the forecast', () => {
      pointerAt(slider(), 'pointermove', 400);
      expect(timeline.selectedHour()).toBe(RECORDED_MORNING_HOUR);

      pointerAt(slider(), 'pointerdown', 50 + 100);
      expect(timeline.selectedHour()).toBe(5);
      pointerAt(slider(), 'pointermove', 50 + 461);
      expect(timeline.selectedHour()).toBe(23);
      pointerAt(slider(), 'pointermove', 5000);
      expect(timeline.selectedHour()).toBe(HOURS - 1);
      pointerAt(slider(), 'pointermove', -100);
      expect(timeline.selectedHour()).toBe(0);
      pointerAt(slider(), 'pointercancel', 0);

      pointerAt(slider(), 'pointermove', 50 + 300);
      expect(timeline.selectedHour()).toBe(0);
    });

    it('stops playback, even on the selected hour', () => {
      timeline.play();
      pointerAt(slider(), 'pointerdown', 50 + RECORDED_MORNING_HOUR * 20 + 1);
      expect(timeline.isPlaying()).toBe(false);
      expect(timeline.selectedHour()).toBe(RECORDED_MORNING_HOUR);
    });
  });

  describe('track', () => {
    it('labels the days, today highlighted', () => {
      const days = Array.from(element.querySelectorAll<HTMLElement>('.day'));
      expect(days.map((day) => day.textContent?.trim())).toEqual(['Sun 18', 'Mon 19']);
      expect(days.map((day) => day.classList.contains('today'))).toEqual([true, false]);
      expect(days[1]?.style.left).toBe('50%');
      expect(days[1]?.style.width).toBe('50%');
    });

    it('shades the nights', () => {
      const nights = Array.from(element.querySelectorAll<HTMLElement>('.night'));
      expect(nights.length).toBe(timeline.nights().length);
      const first = timeline.nights()[0];
      expect(nights[0]?.style.width).toBe(`${((first?.count ?? 0) / HOURS) * 100}%`);
    });

    it('fills progress to the middle of the selected hour and moves the handle there', async () => {
      const middle = `${((RECORDED_MORNING_HOUR + 0.5) / HOURS) * 100}%`;
      expect(element.querySelector<HTMLElement>('.progress')?.style.width).toBe(middle);
      const handle = element.querySelector<HTMLElement>('.handle');
      expect(handle?.style.getPropertyValue('--position')).toBe(middle);
      expect(handle?.textContent?.trim()).toBe('Sun 8 AM');
    });

    it('marks the current time between hour ticks', () => {
      // 8:30 AM is halfway through hour 8.
      expect(element.querySelector<HTMLElement>('.now-mark')?.style.left).toBe(
        `${(8.5 / HOURS) * 100}%`,
      );
    });
  });

  describe('buttons', () => {
    it('plays and pauses', async () => {
      button('Play forecast')?.click();
      await fixture.whenStable();
      expect(timeline.isPlaying()).toBe(true);
      expect(button('Pause forecast')).toBeDefined();

      button('Pause forecast')?.click();
      await fixture.whenStable();
      expect(timeline.isPlaying()).toBe(false);
    });

    it('goes back to now', async () => {
      timeline.seek(40);
      button('Now')?.click();
      await fixture.whenStable();
      expect(timeline.selectedHour()).toBe(RECORDED_MORNING_HOUR);
    });
  });
});

describe('TimelineComponent before the forecast loads', () => {
  it('has no hours, handle or progress, and ignores the keys and pointer', async () => {
    TestBed.configureTestingModule({
      providers: provideScriptedForecast(new ScriptedForecastRepository(), RECORDED_MORNING),
    });
    const fixture = TestBed.createComponent(TimelineComponent);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const slider = element.querySelector('[role="slider"]') as HTMLElement;

    expect(slider.getAttribute('aria-valuemax')).toBe('0');
    expect(slider.getAttribute('aria-valuetext')).toBe('');
    expect(element.querySelector('.handle')).toBeNull();
    expect(element.querySelector('.progress')).toBeNull();

    const key = new KeyboardEvent('keydown', { key: 'ArrowRight', cancelable: true });
    slider.dispatchEvent(key);
    expect(key.defaultPrevented).toBe(false);
    pointerAt(slider, 'pointerdown', 10);
    expect(TestBed.inject(TimelineStore).selectedHour()).toBe(0);
  });
});
