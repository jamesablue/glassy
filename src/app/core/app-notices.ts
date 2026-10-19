import { inject, Injectable, signal } from '@angular/core';
import { CLOCK } from './clock';

/**
 * Something that went wrong outside the forecast load, worth a short notice:
 *
 * - `unexpected-error`: an error no code handled reached the app's `ErrorHandler`
 * - `map-tiles-unavailable`: a basemap, land or depth tile source stopped answering
 */
export type AppNoticeKind = 'unexpected-error' | 'map-tiles-unavailable';

/** One raised notice. A new `id` means a new occurrence, even of the same kind. */
export interface AppNotice {
  readonly kind: AppNoticeKind;
  readonly id: number;
}

/** A notice of the same kind is raised at most once in this long, ms. */
export const APP_NOTICE_INTERVAL_MS = 60_000;

/**
 * The channel from code that notices a problem to the shell that tells the user about it. It lives
 * in `core/` because the app's `ErrorHandler` (here) and the map's tile layers report through it,
 * and neither may import the features that show it.
 *
 * Problems like these tend to come in bursts (every tile of a dead source fails, an error in an
 * animation frame repeats), so each kind is raised at most once every
 * {@link APP_NOTICE_INTERVAL_MS}: one notice, rather than a stream of them.
 */
@Injectable({ providedIn: 'root' })
export class AppNotices {
  private readonly clock = inject(CLOCK);
  private readonly latestNotice = signal<AppNotice | null>(null);
  private readonly lastRaised = new Map<AppNoticeKind, number>();
  private nextId = 1;

  /** The notice raised most recently, or `null` before any. */
  readonly latest = this.latestNotice.asReadonly();

  /** Raises a notice, unless one of the same kind was raised less than a minute ago. */
  raise(kind: AppNoticeKind): void {
    const now = this.clock.now();
    const last = this.lastRaised.get(kind);
    if (last !== undefined && now - last < APP_NOTICE_INTERVAL_MS) return;
    this.lastRaised.set(kind, now);
    this.latestNotice.set({ kind, id: this.nextId++ });
  }
}
