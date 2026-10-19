import { Component, computed, inject, linkedSignal, viewChild } from '@angular/core';
import { PanelComponent } from '../../shared/ui';
import { ConditionsStore, ForecastStore, MapUiStore, TimelineStore } from '../../state';
import { AboutPopoverComponent } from '../about/about-popover.component';
import { LayerMenuComponent } from '../layer-picker/layer-menu.component';
import { LegendComponent } from '../legend/legend.component';
import { UnitsPopoverComponent } from '../settings/units-popover.component';
import { SpotDetailPanelComponent } from '../spot-detail/spot-detail-panel.component';
import { SpotRankingPanelComponent } from '../spot-ranking/spot-ranking-panel.component';
import { TimelineComponent } from '../timeline/timeline.component';
import { BrandBadgeComponent } from './brand-badge.component';
import { forecastNotice, sameNotice } from './forecast-notice';
import { shortcutFor } from './keyboard-shortcuts';
import { LoadingOverlayComponent } from './loading-overlay.component';
import { NotificationToastComponent } from './notification-toast.component';

/**
 * Everything that floats over the map: the brand, the side panel (the ranking, or a spot's details
 * when one is selected), the layer menu with its popovers, the legend, the timeline, the loading
 * overlay and forecast notices.
 *
 * It also owns the app-wide keys (see `shortcutFor`): ← and → step the hour, Space plays or pauses,
 * and Escape closes the spot details. An open popover gets Escape first, which the browser handles.
 */
@Component({
  selector: 'glassy-app-shell',
  imports: [
    AboutPopoverComponent,
    BrandBadgeComponent,
    LayerMenuComponent,
    LegendComponent,
    LoadingOverlayComponent,
    NotificationToastComponent,
    PanelComponent,
    SpotDetailPanelComponent,
    SpotRankingPanelComponent,
    TimelineComponent,
    UnitsPopoverComponent,
  ],
  templateUrl: './app-shell.component.html',
  styleUrl: './app-shell.component.scss',
  host: { '(document:keydown)': 'onKeydown($event)' },
})
export class AppShellComponent {
  private readonly forecast = inject(ForecastStore);
  private readonly timeline = inject(TimelineStore);
  private readonly mapUi = inject(MapUiStore);
  private readonly conditions = inject(ConditionsStore);

  protected readonly legendSpec = this.conditions.legendSpec;
  protected readonly detailOpen = computed(() => this.mapUi.selectedSpotId() !== null);
  /** Only the first load covers the map; a reload keeps the forecast on show until it is done. */
  protected readonly loading = computed(
    () => this.forecast.status() === 'loading' && !this.forecast.bundle(),
  );

  private readonly forecastNotice = computed(
    () =>
      forecastNotice(
        this.forecast.status(),
        this.forecast.isRateLimited(),
        this.forecast.fetchedAt(),
      ),
    { equal: sameNotice },
  );
  /** Set when a notice hides itself; a different notice shows again. */
  private readonly noticeDismissed = linkedSignal({
    source: this.forecastNotice,
    computation: () => false,
  });
  protected readonly notice = computed(() =>
    this.noticeDismissed() ? null : this.forecastNotice(),
  );

  private readonly unitsPopover = viewChild.required(UnitsPopoverComponent);
  private readonly aboutPopover = viewChild.required(AboutPopoverComponent);

  protected retry(): void {
    this.forecast.reload();
  }

  protected dismissNotice(): void {
    this.noticeDismissed.set(true);
  }

  protected onKeydown(event: KeyboardEvent): void {
    const shortcut = shortcutFor(event);
    if (shortcut === 'close') {
      // The browser closes an open popover on Escape; the details wait for the next one.
      if (!this.unitsPopover().isOpen() && !this.aboutPopover().isOpen()) {
        this.mapUi.clearSelection();
      }
      return;
    }
    // The timeline keys do nothing until there is a forecast to move through.
    if (!shortcut || this.timeline.hourCount() === 0) return;
    event.preventDefault();
    if (shortcut === 'toggle-play') this.timeline.togglePlay();
    else this.timeline.step(shortcut === 'next-hour' ? 1 : -1);
  }
}
