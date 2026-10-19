import { Component, computed, input, output } from '@angular/core';
import type { HeightUnit } from '../../domain/models';
import { HeightPipe, HstTimePipe, SurfRangePipe } from '../../shared/pipes';
import type { ScoreTrendPoint } from '../../state';
import { hourAtOffset } from '../timeline/timeline-geometry';
import { dailySummary, TREND_CHART, trendGeometry } from './score-trend';

let nextId = 0;

/**
 * A spot's snorkel score and surf for every forecast hour, in SVG: bars coloured by rating (dimmed
 * at night, over a darker night band), the surf line, day separators and labels, and a marker on
 * the selected hour.
 *
 * Clicking or dragging across it picks an hour (`hourSelect`), a pointer shortcut for the timeline,
 * which is the keyboard-accessible way to do the same. Screen readers get the chart's name and
 * description, and a day-by-day summary table in place of the bars.
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
  protected readonly titleId = `score-trend-title-${nextId}`;
  protected readonly descriptionId = `score-trend-description-${nextId++}`;
  protected readonly labelledBy = `${this.titleId} ${this.descriptionId}`;

  protected readonly geometry = computed(() => trendGeometry(this.points()));
  protected readonly viewBox = computed(
    () => `0 0 ${this.geometry().hourCount} ${TREND_CHART.height}`,
  );
  /** Day separators: the start of every day but the first. */
  protected readonly separators = computed(() => this.geometry().days.slice(1));
  protected readonly markerX = computed(() => this.selectedHour() + 0.5);
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

  private pick(event: PointerEvent, plot: HTMLElement): void {
    const box = plot.getBoundingClientRect();
    const hour = hourAtOffset(event.clientX - box.left, box.width, this.points().length);
    if (hour !== this.selectedHour()) this.hourSelect.emit(hour);
  }
}
