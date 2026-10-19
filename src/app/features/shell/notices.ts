import { timeLabel } from '../../domain/time';
import type { ForecastStatus } from '../../state';

/** How long a notice without an action stays up, ms. */
export const NOTICE_AUTO_HIDE_MS = 7000;

/** A message about the forecast for the notification toast. */
export interface ForecastNotice {
  readonly message: string;
  /** A button that loads the forecast again, or `null` for none. */
  readonly actionLabel: 'Retry' | null;
  /** Announced at once (an alert) rather than when the screen reader is idle. */
  readonly urgent: boolean;
  /** Hides itself after this long, ms, or stays until acted on (`null`). */
  readonly autoHideMs: number | null;
}

/**
 * What to tell the user about the forecast, or `null` when all is well:
 *
 * - `stale`: the refresh failed, so an older forecast is on show; says how old, then goes away
 * - `error`, rate limited: Open-Meteo is turning requests away; try again in a minute
 * - `error`: nothing could be loaded; check the connection and retry
 *
 * @param fetchedAt when the forecast on show was fetched, Unix milliseconds
 */
export function forecastNotice(
  status: ForecastStatus,
  rateLimited: boolean,
  fetchedAt: number | undefined,
): ForecastNotice | null {
  switch (status) {
    case 'stale':
      return {
        message:
          fetchedAt === undefined
            ? "Couldn't refresh the forecast. Showing an older one."
            : `Couldn't refresh the forecast. Showing data from ${timeLabel(fetchedAt / 1000)}.`,
        actionLabel: null,
        urgent: false,
        autoHideMs: NOTICE_AUTO_HIDE_MS,
      };
    case 'error':
      return {
        message: rateLimited
          ? 'The forecast service is getting too many requests. Try again in a minute.'
          : "Couldn't load the forecast. Check your connection and try again.",
        actionLabel: 'Retry',
        urgent: true,
        autoHideMs: null,
      };
    default:
      return null;
  }
}

/** Whether two notices say the same thing, so a recomputed notice does not count as a new one. */
export function sameNotice(a: ForecastNotice | null, b: ForecastNotice | null): boolean {
  return a?.message === b?.message;
}
