import { inputBinding, outputBinding, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { pointerAt, setHorizontalBox, stubPointerCapture } from '../../../testing/pointer';
import type { HeightUnit } from '../../domain/models';
import { rateScore } from '../../domain/scoring';
import type { ScoreTrendPoint } from '../../state';
import { TREND_CHART } from './score-trend';
import { ScoreTrendChartComponent } from './score-trend-chart.component';

/** Midnight on Sunday 18 October 2026 in Honolulu. */
const MIDNIGHT = Date.UTC(2026, 9, 18, 10) / 1000;
const HOURS = 48;

const POINTS: ScoreTrendPoint[] = Array.from({ length: HOURS }, (_, hour) => ({
  hour,
  time: MIDNIGHT + hour * 3600,
  score: (hour * 7) % 11,
  surf: 0.2 + (hour % 5) * 0.1,
  isDay: hour % 24 >= 6 && hour % 24 < 18,
}));

describe('ScoreTrendChartComponent', () => {
  const selectedHour = signal(8);
  const heightUnit = signal<HeightUnit>('ft');
  let picked: number[];
  let fixture: ComponentFixture<ScoreTrendChartComponent>;
  let element: HTMLElement;
  let restorePointerCapture: () => void;

  beforeEach(async () => {
    restorePointerCapture = stubPointerCapture();
    picked = [];
    selectedHour.set(8);
    fixture = TestBed.createComponent(ScoreTrendChartComponent, {
      bindings: [
        inputBinding('points', () => POINTS),
        inputBinding('selectedHour', selectedHour),
        inputBinding('heightUnit', heightUnit),
        outputBinding<number>('hourSelect', (hour) => picked.push(hour)),
      ],
    });
    element = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
  });

  afterEach(() => restorePointerCapture());

  const plot = (): HTMLElement => element.querySelector('.plot') as HTMLElement;
  const bars = (): SVGRectElement[] => Array.from(element.querySelectorAll('rect.bar'));

  it('draws a bar per hour, as tall as the score and in its rating colour', () => {
    const plotHeight = TREND_CHART.bottom - TREND_CHART.top;
    expect(bars()).toHaveLength(HOURS);
    bars().forEach((bar, hour) => {
      const score = POINTS[hour]?.score ?? NaN;
      expect(Number(bar.getAttribute('height'))).toBeCloseTo(
        Math.max(1, (score / 10) * plotHeight),
        1,
      );
      expect(bar.getAttribute('fill')).toBe(rateScore(score).color);
    });
  });

  it('dims the night hours', () => {
    expect(bars()[3]?.classList.contains('dim')).toBe(true);
    expect(bars()[12]?.classList.contains('dim')).toBe(false);
    expect(element.querySelectorAll('rect.night')).toHaveLength(3);
  });

  it('labels the days and separates them', () => {
    expect(Array.from(element.querySelectorAll('.day'), (day) => day.textContent)).toEqual([
      'Sun',
      'Mon',
    ]);
    expect(element.querySelectorAll('line.separator')).toHaveLength(1);
  });

  it('labels the highest surf in the chosen unit', async () => {
    expect(element.querySelector('.surf-max')?.textContent?.trim()).toBe('surf max 2.0 ft');
    heightUnit.set('m');
    await fixture.whenStable();
    expect(element.querySelector('.surf-max')?.textContent?.trim()).toBe('surf max 0.6 m');
    heightUnit.set('ft');
  });

  it('marks the selected hour', async () => {
    const marker = (): string | null | undefined =>
      element.querySelector('line.marker')?.getAttribute('x1');
    expect(marker()).toBe('8.5');
    selectedHour.set(30);
    await fixture.whenStable();
    expect(marker()).toBe('30.5');
  });

  it('picks the hour under a click', () => {
    setHorizontalBox(plot(), 100, 480);
    pointerAt(plot(), 'pointerdown', 100 + 10 * 25 + 3);
    pointerAt(plot(), 'pointerup', 100 + 10 * 25 + 3);
    expect(picked).toEqual([25]);
  });

  it('follows a drag across the chart, clamped to the forecast', () => {
    setHorizontalBox(plot(), 0, 480);
    pointerAt(plot(), 'pointermove', 200);
    pointerAt(plot(), 'pointerdown', 100);
    pointerAt(plot(), 'pointermove', 205);
    pointerAt(plot(), 'pointermove', 900);
    pointerAt(plot(), 'pointercancel', 900);
    pointerAt(plot(), 'pointermove', 50);
    expect(picked).toEqual([10, 20, HOURS - 1]);
  });

  it('does not ask for the hour that is already selected', () => {
    setHorizontalBox(plot(), 0, 480);
    pointerAt(plot(), 'pointerdown', 85);
    expect(picked).toEqual([]);
  });

  it('is a slider over the hours, named, described and read out hour by hour', () => {
    const slider = plot();
    expect(slider.getAttribute('role')).toBe('slider');
    expect(slider.tabIndex).toBe(0);
    expect(slider.getAttribute('aria-label')).toBe('Snorkel score and surf by hour');
    expect(slider.getAttribute('aria-valuemin')).toBe('0');
    expect(slider.getAttribute('aria-valuemax')).toBe(String(HOURS - 1));
    expect(slider.getAttribute('aria-valuenow')).toBe('8');
    expect(slider.getAttribute('aria-valuetext')).toBe(
      'Sun 8 AM: score 1.0, Hazardous; surf 1–2 ft',
    );
    const description = document.getElementById(slider.getAttribute('aria-describedby') ?? '');
    expect(description?.textContent).toContain('Bars show');
    expect(element.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('moves through the hours from the keyboard', () => {
    const key = (name: string): KeyboardEvent => {
      const event = new KeyboardEvent('keydown', { key: name, cancelable: true });
      plot().dispatchEvent(event);
      return event;
    };
    expect(key('ArrowRight').defaultPrevented).toBe(true);
    key('ArrowLeft');
    key('PageUp');
    key('End');
    key('Home');
    expect(picked).toEqual([9, 7, 32, HOURS - 1, 0]);
    expect(key('Tab').defaultPrevented).toBe(false);
  });

  it('does not ask for an hour past either end', () => {
    selectedHour.set(0);
    fixture.detectChanges();
    plot().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', cancelable: true }));
    plot().dispatchEvent(new KeyboardEvent('keydown', { key: 'PageDown', cancelable: true }));
    expect(picked).toEqual([]);
  });

  it('has a day-by-day table for screen readers', () => {
    const rows = Array.from(element.querySelectorAll('table.visually-hidden tbody tr'), (row) =>
      Array.from(row.children, (cell) => cell.textContent?.trim()),
    );
    expect(rows).toEqual([
      ['Sun 18', '10.0 at 3 AM', '0.0', '1–2 ft'],
      ['Mon 19', '10.0 at 1 AM', '0.0', '1–2 ft'],
    ]);
  });
});
