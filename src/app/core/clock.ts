import { InjectionToken } from '@angular/core';

/** The current time. Code that depends on "now" asks for this instead of calling `Date.now()`. */
export interface Clock {
  /** Unix milliseconds. */
  now(): number;
}

/**
 * The app's {@link Clock}, the system clock unless replaced. Tests provide a fixed or advancing
 * clock so that "which forecast hour is now" has one answer however and whenever they run.
 */
export const CLOCK = new InjectionToken<Clock>('CLOCK', {
  providedIn: 'root',
  factory: () => ({ now: () => Date.now() }),
});
