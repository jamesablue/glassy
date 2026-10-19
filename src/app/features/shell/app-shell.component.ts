import { Component, computed, inject, viewChild } from '@angular/core';
import { PanelComponent } from '../../shared/ui';
import { ConditionsStore, MapUiStore, TimelineStore } from '../../state';
import { AboutPopoverComponent } from '../about/about-popover.component';
import { LayerMenuComponent } from '../layer-picker/layer-menu.component';
import { LegendComponent } from '../legend/legend.component';
import { UnitsPopoverComponent } from '../settings/units-popover.component';
import { SpotDetailPanelComponent } from '../spot-detail/spot-detail-panel.component';
import { SpotRankingPanelComponent } from '../spot-ranking/spot-ranking-panel.component';
import { TimelineComponent } from '../timeline/timeline.component';
import { BrandBadgeComponent } from './brand-badge.component';
import { HourAnnouncerComponent } from './hour-announcer.component';
import { shortcutFor } from './keyboard-shortcuts';
import { StatusMessagesComponent } from './status-messages.component';

/**
 * Everything that floats over the map: the brand, the side panel (the ranking, or a spot's details
 * when one is selected), the layer menu with its popovers, the legend, the timeline, the status
 * messages and the hour announcer.
 *
 * It also owns the app-wide keys (see `shortcutFor`): ← and → step the hour, Space plays or pauses,
 * and Escape closes the innermost thing that is open. An open popover gets Escape first, which the
 * browser handles; then the map's point readout; then the spot details.
 */
@Component({
  selector: 'glassy-app-shell',
  imports: [
    AboutPopoverComponent,
    BrandBadgeComponent,
    HourAnnouncerComponent,
    LayerMenuComponent,
    LegendComponent,
    PanelComponent,
    SpotDetailPanelComponent,
    SpotRankingPanelComponent,
    StatusMessagesComponent,
    TimelineComponent,
    UnitsPopoverComponent,
  ],
  templateUrl: './app-shell.component.html',
  styleUrl: './app-shell.component.scss',
  host: { '(document:keydown)': 'onKeydown($event)' },
})
export class AppShellComponent {
  private readonly timeline = inject(TimelineStore);
  private readonly mapUi = inject(MapUiStore);
  private readonly conditions = inject(ConditionsStore);

  protected readonly legendSpec = this.conditions.legendSpec;
  protected readonly detailOpen = computed(() => this.mapUi.selectedSpotId() !== null);

  private readonly unitsPopover = viewChild.required(UnitsPopoverComponent);
  private readonly aboutPopover = viewChild.required(AboutPopoverComponent);

  protected onKeydown(event: KeyboardEvent): void {
    const shortcut = shortcutFor(event);
    if (shortcut === 'close') {
      this.closeInnermost();
      return;
    }
    // The timeline keys do nothing until there is a forecast to move through.
    if (!shortcut || this.timeline.hourCount() === 0) return;
    event.preventDefault();
    if (shortcut === 'toggle-play') this.timeline.togglePlay();
    else this.timeline.step(shortcut === 'next-hour' ? 1 : -1);
  }

  /** Escape: the point readout, else the spot details. An open popover closes itself first. */
  private closeInnermost(): void {
    if (this.unitsPopover().isOpen() || this.aboutPopover().isOpen()) return;
    if (this.mapUi.inspectedPoint()) this.mapUi.clearInspection();
    else this.mapUi.clearSelection();
  }
}
