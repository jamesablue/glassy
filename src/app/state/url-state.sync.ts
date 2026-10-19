import { Location } from '@angular/common';
import {
  DestroyRef,
  effect,
  inject,
  Injectable,
  Injector,
  provideAppInitializer,
  signal,
  untracked,
  type EnvironmentProviders,
} from '@angular/core';
import { LAYER_IDS } from '../domain/models';
import { hourKey, parseHourKey } from '../domain/time';
import { MapUiStore } from './map-ui.store';
import { oneOf } from './parse';
import { DEFAULT_PREFERENCES } from './settings.store';
import { TimelineStore } from './timeline.store';

/** The query parameters that describe a view. */
export const URL_STATE_PARAMS = ['layer', 'spot', 't'] as const;

type UrlState = Readonly<Record<(typeof URL_STATE_PARAMS)[number], string | null>>;

/** A `t` from the URL, waiting for a forecast to find its hour in. */
interface PendingTime {
  readonly key: string;
  readonly seconds: number;
}

/**
 * Keeps the view in the URL so it can be shared as a link, for example
 * `/?layer=depth&spot=hanauma&t=2026-10-20T08`:
 *
 * - `layer`: the map layer (`wind`, `waves`, `swell`, `period` or `depth`); omitted for `waves`
 * - `spot`: the selected spot's id in the spot catalog; omitted when no spot is selected
 * - `t`: the selected hour in Honolulu time as `YYYY-MM-DDTHH`; omitted when it is the current hour
 *
 * `t` names a wall-clock hour rather than an index, so a link opened later still points at the same
 * hour; it is applied once the forecast has loaded and clamped to the forecast's range.
 *
 * Glassy is a single view whose state lives in the query string, so this talks to `Location`
 * directly rather than through the router:
 *
 * - **URL to state** happens when the app starts, before anything can write, and on every
 *   `popstate` (the back and forward buttons). A parameter that is missing, unknown or malformed is
 *   ignored and leaves its part of the view as it was, so a link without `layer` keeps the viewer's
 *   own saved layer.
 * - **Any other path**, such as an old or mistyped link (or GitHub Pages' `404.html` fallback, which
 *   serves the app for every path), is replaced by the app's own path with the query kept.
 * - **State to URL** merges into the existing query, so parameters that belong to someone else
 *   stay. It replaces the history entry instead of adding one (stepping through 120 hours should not
 *   fill the back button) and is skipped when the URL already matches. `Location` reports only
 *   `popstate` to its subscribers, so these writes are never read back.
 */
@Injectable({ providedIn: 'root' })
export class UrlStateSync {
  private readonly location = inject(Location);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  private readonly mapUi = inject(MapUiStore);
  private readonly timeline = inject(TimelineStore);

  private readonly pendingTime = signal<PendingTime | null>(null);
  private started = false;

  /** Starts syncing. {@link provideUrlStateSync} calls it at startup; later calls do nothing. */
  start(): void {
    if (this.started) return;
    this.started = true;

    const { path, query } = splitUrl(this.location.path());
    if (path !== '' && path !== '/') this.location.replaceState(appUrl(query));
    this.restore(new URLSearchParams(query));

    const popstate = this.location.subscribe(({ url }) =>
      this.restore(new URLSearchParams(splitUrl(url ?? this.location.path()).query)),
    );
    this.destroyRef.onDestroy(() => popstate.unsubscribe());

    const options = { injector: this.injector };
    effect(() => this.applyPendingTime(), options);
    effect(() => this.writeUrl(), options);
  }

  private restore(params: URLSearchParams): void {
    const layer = oneOf(LAYER_IDS, params.get('layer'));
    if (layer) this.mapUi.setLayer(layer);

    const spot = params.get('spot');
    if (spot !== null) this.mapUi.selectSpot(spot);

    const key = params.get('t') ?? '';
    const seconds = parseHourKey(key);
    if (seconds !== null) this.pendingTime.set({ key, seconds });
  }

  private applyPendingTime(): void {
    const pending = this.pendingTime();
    if (!pending || this.timeline.hourCount() === 0) return;
    untracked(() => {
      this.timeline.seekToTime(pending.seconds);
      this.pendingTime.set(null);
    });
  }

  private writeUrl(): void {
    const layer = this.mapUi.activeLayer();
    const state: UrlState = {
      layer: layer === DEFAULT_PREFERENCES.map.layer ? null : layer,
      spot: this.mapUi.selectedSpotId(),
      t: this.pendingTime()?.key ?? this.selectedHourKey(),
    };
    untracked(() => {
      const current = new URLSearchParams(splitUrl(this.location.path()).query);
      const next = new URLSearchParams(current);
      for (const param of URL_STATE_PARAMS) {
        const value = state[param];
        if (value === null) next.delete(param);
        else next.set(param, value);
      }
      if (next.toString() !== current.toString()) {
        this.location.replaceState(appUrl(next.toString()));
      }
    });
  }

  /** The selected hour as a `t` value, or `null` when it is the current hour or nothing loaded. */
  private selectedHourKey(): string | null {
    const time = this.timeline.selectedTime();
    const isNow = this.timeline.selectedHour() === this.timeline.nowHour();
    return time === undefined || isNow ? null : hourKey(time);
  }
}

/** Restores the view from the URL at startup and keeps the URL up to date from then on. */
export function provideUrlStateSync(): EnvironmentProviders {
  return provideAppInitializer(() => inject(UrlStateSync).start());
}

/** A path from `Location` (relative to the base href) split at its query, without a fragment. */
function splitUrl(url: string): { path: string; query: string } {
  const withoutHash = url.split('#', 1)[0] ?? '';
  const at = withoutHash.indexOf('?');
  return at < 0
    ? { path: withoutHash, query: '' }
    : { path: withoutHash.slice(0, at), query: withoutHash.slice(at + 1) };
}

/** The app's one page with `query`, relative to the base href. */
function appUrl(query: string): string {
  return query === '' ? '/' : `/?${query}`;
}
