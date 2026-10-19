import { Component, computed, input, output } from '@angular/core';
import { clamp } from '../../domain/math';
import type { HeightUnit } from '../../domain/models';
import { HeightPipe, HstTimePipe, SurfRangePipe } from '../../shared/pipes';
import type { ScoreTrendPoint } from '../../state';
import { hourAtOffset, hourForKey } from '../timeline/timeline-geometry';
import { dailySummary, TREND_CHART, trendGeometry, trendValueText } from './score-trend';

let nextId = 0;

/**
 * A spot's snorkel score and surf for every forecast hour, in SVG: bars coloured by rating (dimmed
 * at night, over a darker night band), the surf line, day separators and labels, and a marker on
 * the selected hour.
 *
 * It is a slider over the hours, like the timeline it moves: clicking or dragging across it picks
 * an hour (`hourSelect`), and so do the arrow keys (Page Up and Page Down move a day, Home and End
 * go to the ends). Screen readers hear each hour's score, rating and surf as the slider's value,
 * then a description, and get a day-by-day summary table in place of the bars.
 */
@Component({
  selector: 'glassy-score-trend-chart',
  imports: [HeightPipe, HstTimePipe, SurfRangePipe],
  templateUrl: './score-trend-chart.component.html',
  styleUrl: './score-trend-chart.component.scss',
})
export class ScoreTrendChartComponent {
  readonly points = input.required<readonly ScoreTrendPoint[]>();
  readonly selectedHour = input.required<number>();
  readonly heightUnit = input.required<HeightUnit>();

  /** The user clicked or dragged to an hour. */
  readonly hourSelect = output<number>();

  protected readonly chart = TREND_CHART;
  protected readonly descriptionId = `score-trend-description-${nextId++}`;

  protected readonly geometry = computed(() => trendGeometry(this.points()));
  protected readonly viewBox = computed(
    () => `0 0 ${this.geometry().hourCount} ${TREND_CHART.height}`,
  );
  /** Day separators: the start of every day but the first. */
  protected readonly separators = computed(() => this.geometry().days.slice(1));
  protected readonly markerX = computed(() => this.selectedHour() + 0.5);
  protected readonly maxHour = computed(() => Math.max(this.points().length - 1, 0));
  /** The selected hour in words, for example "Mon 12 PM: score 7.4, Good; surf 2–3 ft". */
  protected readonly valueText = computed(() =>
    trendValueText(this.points()[this.selectedHour()], this.heightUnit()),
  );
  protected readonly summary = computed(() =>
    dailySummary(this.points()).map((day) => ({
      ...day,
      best: day.bestScore.toFixed(1),
      lowest: day.lowestScore.toFixed(1),
    })),
  );

  private dragging = false;

  protected onPointerDown(event: PointerEvent): void {
    const plot = event.currentTarget as HTMLElement;
    plot.setPointerCapture(event.pointerId);
    this.dragging = true;
    this.pick(event, plot);
  }

  protected onPointerMove(event: PointerEvent): void {
    if (this.dragging) this.pick(event, event.currentTarget as HTMLElement);
  }

  protected onPointerEnd(): void {
    this.dragging = false;
  }

  protected onKeydown(event: KeyboardEvent): void {
    const count = this.points().length;
    const target = hourForKey(event.key, this.selectedHour(), count);
    if (target === null || count === 0) return;
    // Handled here, so the app-wide arrow-key shortcuts leave it alone.
    event.preventDefault();
    const hour = clamp(target, 0, count - 1);
    if (hour !== this.selectedHour()) this.hourSelect.emit(hour);
  }

  private pick(event: PointerEvent, plot: HTMLElement): void {
    const box = plot.getBoundingClientRect();
    const hour = hourAtOffset(event.clientX - box.left, box.width, this.points().length);
    if (hour !== this.selectedHour()) this.hourSelect.emit(hour);
  }
}
