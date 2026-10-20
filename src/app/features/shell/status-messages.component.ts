import { Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { AppNotices } from '../../core/app-notices';
import { ConnectivityStore, ForecastStore } from '../../state';
import { LoadErrorComponent } from './load-error.component';
import { LoadingOverlayComponent } from './loading-overlay.component';
import { MapLayersChipComponent } from './map-layers-chip.component';
import {
  appNotice,
  forecastNotice,
  loadErrorMessage,
  mapLayersPending,
  sameNotice,
  type ForecastState,
  type Notice,
} from './notices';
import { NotificationToastComponent } from './notification-toast.component';

/** The notice on show, and where it came from, so hiding it hides the right one. */
interface ShownNotice extends Notice {
  /** `forecast` for the forecast's state, otherwise the id of an `AppNotices` notice. */
  readonly source: 'forecast' | number;
}

/**
 * What the app has to say about itself, one thing at a time:
 *
 * - the loading overlay over the first load, until the spot forecast arrives
 * - the "Loading map layers…" chip while the map grid follows it; it never blocks anything, so it
 *   can sit alongside a toast
 * - the load error screen when the first load fails with nothing cached (Retry, or Escape)
 * - otherwise a toast: about the forecast first (refreshing, stale, offline, map overlay missing,
 *   failed), then the latest problem reported through `AppNotices` (map tiles, unexpected errors)
 *
 * The rules for what each says live in `notices.ts`.
 */
@Component({
  selector: 'glassy-status-messages',
  imports: [
    LoadErrorComponent,
    LoadingOverlayComponent,
    MapLayersChipComponent,
    NotificationToastComponent,
  ],
  template: `
    @if (loading()) {
      <glassy-loading-overlay />
    }
    @if (mapLayersPending()) {
      <glassy-map-layers-chip />
    }
    @if (loadError(); as error) {
      <glassy-load-error
        [title]="error.title"
        [detail]="error.detail"
        (retry)="retry()"
        (dismiss)="dismissLoadError()"
      />
    } @else if (notice(); as notice) {
      <glassy-notification-toast
        [message]="notice.message"
        [actionLabel]="notice.actionLabel"
        [urgent]="notice.urgent"
        [autoHideMs]="notice.autoHideMs"
        (action)="retry()"
        (dismiss)="dismissNotice(notice.source)"
      />
    }
  `,
  host: { style: 'display: contents' },
})
export class StatusMessagesComponent {
  private readonly forecast = inject(ForecastStore);
  private readonly connectivity = inject(ConnectivityStore);
  private readonly appNotices = inject(AppNotices);

  /** Only the first load covers the map; a reload keeps the forecast on show until it is done. */
  protected readonly loading = computed(
    () => this.forecast.status() === 'loading' && !this.forecast.bundle(),
  );

  /** Set when the load error screen is closed; the next load can bring it back. */
  private readonly loadErrorDismissed = linkedSignal({
    source: this.forecast.status,
    computation: () => false,
  });
  /** The first load failed and there is nothing to show: say so full screen, with Retry. */
  protected readonly loadError = computed(() => {
    if (this.forecast.status() !== 'error' || this.forecast.bundle()) return null;
    if (this.loadErrorDismissed()) return null;
    return loadErrorMessage(this.forecast.isRateLimited(), this.connectivity.online());
  });

  private readonly forecastState = computed<ForecastState>(() => ({
    status: this.forecast.status(),
    rateLimited: this.forecast.isRateLimited(),
    fetchedAt: this.forecast.fetchedAt(),
    online: this.connectivity.online(),
    gridStatus: this.forecast.gridStatus(),
  }));
  /** The spot forecast is on show and the map's colours and particles are on their way. */
  protected readonly mapLayersPending = computed(() => mapLayersPending(this.forecastState()));
  private readonly forecastNotice = computed(() => forecastNotice(this.forecastState()), {
    equal: sameNotice,
  });
  /** Set when a forecast notice hides itself; a different notice shows again. */
  private readonly forecastNoticeDismissed = linkedSignal({
    source: this.forecastNotice,
    computation: () => false,
  });
  /** The last `AppNotices` notice that was hidden. */
  private readonly appNoticeDismissed = signal<number | null>(null);

  /** The forecast's own notice first, then the latest problem reported through `AppNotices`. */
  protected readonly notice = computed<ShownNotice | null>(() => {
    const forecast = this.forecastNotice();
    if (forecast && !this.forecastNoticeDismissed()) return { ...forecast, source: 'forecast' };
    const reported = this.appNotices.latest();
    if (reported && reported.id !== this.appNoticeDismissed()) {
      return { ...appNotice(reported.kind), source: reported.id };
    }
    return null;
  });

  protected retry(): void {
    this.forecast.reload();
  }

  protected dismissLoadError(): void {
    this.loadErrorDismissed.set(true);
  }

  protected dismissNotice(source: ShownNotice['source']): void {
    if (source === 'forecast') this.forecastNoticeDismissed.set(true);
    else this.appNoticeDismissed.set(source);
  }
}
