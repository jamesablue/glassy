import type { AppNoticeKind } from '../../core/app-notices';
import { timeLabel } from '../../domain/time';
import type { ForecastStatus, GridStatus } from '../../state';

/** How long a notice without an action stays up, ms. */
export const NOTICE_AUTO_HIDE_MS = 7000;

/** What the notice says when the spot forecast loaded but the map grid did not. */
export const MAP_OVERLAY_UNAVAILABLE =
  'Map overlay unavailable right now. The spot forecast still works.';

/** A message for the notification toast. */
export interface Notice {
  readonly message: string;
  /** A button that loads the forecast again, or `null` for none. */
  readonly actionLabel: 'Retry' | null;
  /** Announced at once (an alert) rather than when the screen reader is idle. */
  readonly urgent: boolean;
  /** Hides itself after this long, ms, or stays until acted on (`null`). */
  readonly autoHideMs: number | null;
}

/** Where the forecast stands, as far as what to tell the user goes. */
export interface ForecastState {
  readonly status: ForecastStatus;
  /** Open-Meteo is turning requests away (HTTP 429). */
  readonly rateLimited: boolean;
  /** When the forecast on show was fetched, Unix ms, or `undefined` when there is none. */
  readonly fetchedAt: number | undefined;
  /** Whether the browser reports a network connection. */
  readonly online: boolean;
  /** Where the map grid of the forecast on show stands, or `undefined` when there is none. */
  readonly gridStatus: GridStatus | undefined;
}

/** The full-screen message when the first forecast could not be loaded. */
export interface LoadErrorMessage {
  readonly title: string;
  readonly detail: string;
}

/**
 * What to tell the user about the forecast in a toast, or `null` when all is well:
 *
 * - `loading` with a forecast on show: it is being refreshed (the first load has its own overlay),
 *   whether it is the forecast from before a reload or an older cached one shown meanwhile
 * - `ready`, offline: the forecast on show is all there is until the connection comes back
 * - `ready` without the map grid: the colours and particles could not be loaded, but the spot
 *   forecast is fine; says so politely, then goes away
 * - `stale`: the refresh failed, so an older forecast is on show; says how old, then goes away
 * - `error`: the forecast could not be loaded or refreshed; says why (offline, rate limited, or
 *   anything else) and offers to retry. Without any forecast the shell shows
 *   {@link loadErrorMessage} full screen instead, and this toast only once that is dismissed.
 */
export function forecastNotice({
  status,
  rateLimited,
  fetchedAt,
  online,
  gridStatus,
}: ForecastState): Notice | null {
  const since = fetchedAt === undefined ? undefined : timeLabel(fetchedAt / 1000);
  switch (status) {
    case 'loading':
      return since === undefined ? null : quiet('Refreshing the forecast…', null);
    case 'ready':
      if (!online) return quiet(offlineWith(since), NOTICE_AUTO_HIDE_MS);
      return gridStatus === 'failed' ? quiet(MAP_OVERLAY_UNAVAILABLE, NOTICE_AUTO_HIDE_MS) : null;
    case 'stale':
      if (!online) return quiet(offlineWith(since), NOTICE_AUTO_HIDE_MS);
      return quiet(
        since === undefined
          ? "Couldn't refresh the forecast. Showing an older one."
          : `Couldn't refresh the forecast. Showing data from ${since}.`,
        NOTICE_AUTO_HIDE_MS,
      );
    case 'error':
      return {
        message: errorText(rateLimited, online, since !== undefined),
        actionLabel: 'Retry',
        urgent: true,
        autoHideMs: null,
      };
  }
}

/**
 * Whether to show the "Loading map layers…" chip: a fresh spot forecast is on show and its map grid
 * is still on the way. While a load is in flight with nothing on show, the loading overlay covers
 * it; while a reload is in flight, the "Refreshing" notice does.
 */
export function mapLayersPending({ status, gridStatus }: ForecastState): boolean {
  return status === 'ready' && gridStatus === 'loading';
}

/**
 * The full-screen message for a first load that failed with no forecast to fall back on: offline,
 * rate limited (Open-Meteo answered HTTP 429), or anything else.
 */
export function loadErrorMessage(rateLimited: boolean, online: boolean): LoadErrorMessage {
  if (!online) {
    return {
      title: "You're offline",
      detail: 'The forecast loads by itself when you’re back online.',
    };
  }
  if (rateLimited) {
    return {
      title: 'The forecast service is busy',
      detail: 'Open-Meteo is getting too many requests right now. Try again in a minute.',
    };
  }
  return {
    title: "Couldn't load the forecast",
    detail: 'Check your connection and try again.',
  };
}

/** What a problem reported through `AppNotices` sounds like to the user. */
export function appNotice(kind: AppNoticeKind): Notice {
  switch (kind) {
    case 'map-tiles-unavailable':
      return quiet(
        "Map tiles aren't loading right now. The forecast still works.",
        NOTICE_AUTO_HIDE_MS,
      );
    case 'unexpected-error':
      return quiet(
        'Something went wrong. If the map stops responding, reload the page.',
        NOTICE_AUTO_HIDE_MS,
      );
  }
}

/** Whether two notices say the same thing, so a recomputed notice does not count as a new one. */
export function sameNotice(a: Notice | null, b: Notice | null): boolean {
  return a?.message === b?.message;
}

function quiet(message: string, autoHideMs: number | null): Notice {
  return { message, actionLabel: null, urgent: false, autoHideMs };
}

function offlineWith(since: string | undefined): string {
  return since === undefined
    ? "You're offline. The forecast refreshes when you're back online."
    : `You're offline. Showing the forecast from ${since}; it refreshes when you're back online.`;
}

function errorText(rateLimited: boolean, online: boolean, hasForecast: boolean): string {
  if (!online) return "You're offline. The forecast loads when you're back online.";
  if (rateLimited) {
    return 'The forecast service is getting too many requests. Try again in a minute.';
  }
  return hasForecast
    ? "Couldn't refresh the forecast. Check your connection and try again."
    : "Couldn't load the forecast. Check your connection and try again.";
}
