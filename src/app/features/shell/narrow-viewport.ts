import { DOCUMENT } from '@angular/common';
import { inject, InjectionToken } from '@angular/core';

/** The phone layout's media query, matching the `(max-width: 760px)` blocks in the styles. */
export const NARROW_VIEWPORT_QUERY = '(max-width: 760px)';

/**
 * Whether the app opened on a phone-sized screen, where panels start collapsed so the map stays
 * visible. Read once at startup: the layout itself follows the screen through CSS, but a panel the
 * user has opened should not snap shut when a phone is turned sideways.
 */
export const NARROW_VIEWPORT = new InjectionToken<boolean>('NARROW_VIEWPORT', {
  providedIn: 'root',
  factory: () => inject(DOCUMENT).defaultView?.matchMedia?.(NARROW_VIEWPORT_QUERY).matches ?? false,
});
