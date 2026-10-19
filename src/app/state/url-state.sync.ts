import {
  effect,
  inject,
  Injectable,
  Injector,
  provideAppInitializer,
  signal,
  untracked,
  type EnvironmentProviders,
} from '@angular/core';
import { Router, type ParamMap } from '@angular/router';
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

/** Marks the navigations this service makes, so it does not read its own writes back. */
const OWN_NAVIGATION = Symbol('UrlStateSync');

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
 * **URL to state** happens for every navigation this service did not make itself: the page the app
 * opens on, and any later one. A parameter that is missing, unknown or malformed is ignored and
 * leaves its part of the view as it was, so a link without `layer` keeps the viewer's own saved
 * layer.
 *
 * **State to URL** starts once the opening URL has been read, so it cannot overwrite a shared link
 * before it is applied. Writes merge into the existing query, replace the history entry instead of
 * adding one (stepping through 120 hours should not fill the back button) and are skipped when the
 * URL already matches.
 */
@Injectable({ providedIn: 'root' })
export class UrlStateSync {
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  private readonly mapUi = inject(MapUiStore);
  private readonly timeline = inject(TimelineStore);

  private readonly pendingTime = signal<PendingTime | null>(null);
  private readonly restored = signal(false);
  private started = false;

  /** Starts syncing. {@link provideUrlStateSync} calls it at startup; later calls do nothing. */
  start(): void {
    if (this.started) return;
    this.started = true;
    const options = { injector: this.injector };
    effect(() => this.readUrl(), options);
    effect(() => this.applyPendingTime(), options);
    effect(() => this.writeUrl(), options);
  }

  private readUrl(): void {
    const navigation = this.router.lastSuccessfulNavigation();
    if (!navigation || navigation.extras.info === OWN_NAVIGATION) return;
    const url = navigation.finalUrl ?? navigation.extractedUrl;
    untracked(() => {
      this.restore(url.queryParamMap);
      this.restored.set(true);
    });
  }

  private restore(params: ParamMap): void {
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
    if (!this.restored()) return;
    const layer = this.mapUi.activeLayer();
    const state: UrlState = {
      layer: layer === DEFAULT_PREFERENCES.map.layer ? null : layer,
      spot: this.mapUi.selectedSpotId(),
      t: this.pendingTime()?.key ?? this.selectedHourKey(),
    };
    untracked(() => {
      if (this.urlMatches(state)) return;
      void this.router.navigate([], {
        queryParams: state,
        queryParamsHandling: 'merge',
        replaceUrl: true,
        info: OWN_NAVIGATION,
      });
    });
  }

  /** The selected hour as a `t` value, or `null` when it is the current hour or nothing loaded. */
  private selectedHourKey(): string | null {
    const time = this.timeline.selectedTime();
    const isNow = this.timeline.selectedHour() === this.timeline.nowHour();
    return time === undefined || isNow ? null : hourKey(time);
  }

  private urlMatches(state: UrlState): boolean {
    const current = this.router.parseUrl(this.router.url).queryParamMap;
    return URL_STATE_PARAMS.every((param) => current.get(param) === state[param]);
  }
}

/** Restores the view from the URL at startup and keeps the URL up to date from then on. */
export function provideUrlStateSync(): EnvironmentProviders {
  return provideAppInitializer(() => inject(UrlStateSync).start());
}
