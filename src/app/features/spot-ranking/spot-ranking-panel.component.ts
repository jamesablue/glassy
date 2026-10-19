import { DOCUMENT } from '@angular/common';
import {
  afterNextRender,
  Component,
  computed,
  effect,
  inject,
  Injector,
  linkedSignal,
  untracked,
  viewChildren,
} from '@angular/core';
import { timeLabel } from '../../domain/time';
import { IconComponent } from '../../shared/ui';
import {
  ConditionsStore,
  ForecastStore,
  MapUiStore,
  SettingsStore,
  TimelineStore,
  type RegionFilter,
} from '../../state';
import { NARROW_VIEWPORT } from '../shell/narrow-viewport';
import { RegionFilterComponent } from './region-filter.component';
import { SpotRankingRowComponent } from './spot-ranking-row.component';

/**
 * The side panel's list view: the spots from best to worst at the selected hour, with a region
 * filter. The header folds the list away (it starts folded on a phone, so the map stays visible);
 * opening a spot unfolds it, so the list is there on the way back.
 *
 * When the forecast on show is stale (a refresh failed), the header says when it was fetched. A
 * region with no spots says so, with a way back to all of them.
 *
 * Hovering a row highlights the spot's pin and the other way round, through
 * `MapUiStore.hoveredSpotId`. Clicking a row selects the spot, which opens its details and flies
 * the map there; coming back puts keyboard focus on the row again.
 */
@Component({
  selector: 'glassy-spot-ranking-panel',
  imports: [IconComponent, RegionFilterComponent, SpotRankingRowComponent],
  templateUrl: './spot-ranking-panel.component.html',
  styleUrl: './spot-ranking-panel.component.scss',
})
export class SpotRankingPanelComponent {
  private readonly conditions = inject(ConditionsStore);
  private readonly mapUi = inject(MapUiStore);
  private readonly timeline = inject(TimelineStore);
  private readonly settings = inject(SettingsStore);
  private readonly forecast = inject(ForecastStore);
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);
  private readonly startsNarrow = inject(NARROW_VIEWPORT);

  protected readonly ranked = this.conditions.rankedSpots;
  protected readonly region = this.mapUi.regionFilter;
  protected readonly hoveredId = this.mapUi.hoveredSpotId;
  protected readonly units = this.settings.units;
  /** The hour the ranking is for, for example "Sun 8 PM · after dark". Empty before the forecast. */
  protected readonly timeText = computed(() => {
    const time = this.timeline.selectedTime();
    if (time === undefined) return '';
    return this.timeline.isDaylight() ? timeLabel(time) : `${timeLabel(time)} · after dark`;
  });

  /** Whether a forecast has loaded, so an empty list means an empty region. */
  protected readonly loaded = computed(() => this.timeline.hourCount() > 0);
  /** When the stale forecast on show was fetched, for example "Sun 7 AM", or `null`. */
  protected readonly staleSince = computed(() => {
    const fetchedAt = this.forecast.fetchedAt();
    if (this.forecast.status() !== 'stale' || fetchedAt === undefined) return null;
    return timeLabel(fetchedAt / 1000);
  });

  /** Whether the list is unfolded. Opening a spot unfolds it; closing the spot leaves it as is. */
  protected readonly expanded = linkedSignal<string | null, boolean>({
    source: this.mapUi.selectedSpotId,
    computation: (selected, previous) =>
      selected !== null || (previous?.value ?? !this.startsNarrow),
  });

  private readonly rows = viewChildren(SpotRankingRowComponent);

  constructor() {
    let previous: string | null = null;
    effect(() => {
      const selected = this.mapUi.selectedSpotId();
      if (selected === null && previous !== null) this.returnFocusTo(previous);
      previous = selected;
    });
  }

  protected toggle(): void {
    this.expanded.update((expanded) => !expanded);
  }

  protected setRegion(region: RegionFilter): void {
    this.mapUi.setRegionFilter(region);
  }

  protected select(id: string): void {
    this.mapUi.selectSpot(id);
  }

  protected hover(id: string, hovered: boolean): void {
    this.mapUi.hoverSpot(hovered ? id : null);
  }

  /**
   * Focus was on the closed details, which are gone, so it would fall back to the page. Hand it to
   * the spot's row instead, once the list is showing again.
   */
  private returnFocusTo(id: string): void {
    afterNextRender(
      () => {
        const active = this.document.activeElement;
        if (active && active !== this.document.body) return;
        untracked(this.rows)
          .find((row) => row.entry().spot.id === id)
          ?.focus();
      },
      { injector: this.injector },
    );
  }
}
