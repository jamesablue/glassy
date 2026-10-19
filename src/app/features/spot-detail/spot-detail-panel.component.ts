import { DOCUMENT } from '@angular/common';
import { afterNextRender, Component, computed, ElementRef, inject, viewChild } from '@angular/core';
import { HstTimePipe } from '../../shared/pipes';
import { IconComponent, RatingBadgeComponent } from '../../shared/ui';
import { ConditionsStore, MapUiStore, SettingsStore, TimelineStore } from '../../state';
import { BestWindowComponent } from './best-window.component';
import { ConditionsGridComponent } from './conditions-grid.component';
import { HazardNoticeComponent } from './hazard-notice.component';
import { ScoreTrendChartComponent } from './score-trend-chart.component';

/**
 * The side panel's detail view for the selected spot: its rating and score at the selected hour,
 * warnings, the conditions grid, the score trend with the best window ahead, and notes.
 *
 * The shell loads it with `@defer` the first time a spot is opened, so it stays out of the initial
 * bundle. Picking an hour on the chart moves the timeline; the back button clears the selection.
 */
@Component({
  selector: 'glassy-spot-detail-panel',
  imports: [
    BestWindowComponent,
    ConditionsGridComponent,
    HazardNoticeComponent,
    HstTimePipe,
    IconComponent,
    RatingBadgeComponent,
    ScoreTrendChartComponent,
  ],
  templateUrl: './spot-detail-panel.component.html',
  styleUrl: './spot-detail-panel.component.scss',
})
export class SpotDetailPanelComponent {
  private readonly conditions = inject(ConditionsStore);
  private readonly mapUi = inject(MapUiStore);
  private readonly timeline = inject(TimelineStore);
  private readonly settings = inject(SettingsStore);
  private readonly document = inject(DOCUMENT);

  protected readonly spot = this.mapUi.selectedSpot;
  protected readonly detail = this.conditions.selectedSpotDetail;
  protected readonly units = this.settings.units;
  protected readonly times = this.timeline.times;
  protected readonly selectedHour = this.timeline.selectedHour;
  protected readonly selectedTime = this.timeline.selectedTime;
  protected readonly isDaylight = this.timeline.isDaylight;

  protected readonly meta = computed(() => {
    const spot = this.spot();
    return spot ? `${spot.region} · ${spot.level}` : '';
  });
  protected readonly scoreText = computed(() => this.detail()?.conditions.score.toFixed(1) ?? '');
  protected readonly chartTitle = computed(() => {
    const days = this.timeline.days().length;
    return days === 1 ? 'Next day' : `Next ${days} days`;
  });

  private readonly backButton = viewChild.required<ElementRef<HTMLButtonElement>>('back');

  constructor() {
    // Opened from the list, whose row is now hidden, focus would fall back to the page: start
    // keyboard users at the back button instead. Opened from a map pin, focus stays on the pin.
    afterNextRender(() => {
      const active = this.document.activeElement;
      if (!active || active === this.document.body) this.backButton().nativeElement.focus();
    });
  }

  protected close(): void {
    this.mapUi.clearSelection();
  }

  protected seek(hour: number): void {
    this.timeline.seek(hour);
  }
}
