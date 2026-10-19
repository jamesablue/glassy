import { DOCUMENT } from '@angular/common';
import { DestroyRef, inject, InjectionToken, signal, type Signal } from '@angular/core';

/** The media query for the operating system's "reduce motion" setting. */
export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/**
 * Whether the user has asked for less motion, following the setting as it changes. Code that
 * animates on its own (map flights, for example) reads it and moves instantly instead; CSS checks
 * the same media query for transitions.
 *
 * Tests provide a plain signal.
 */
export const PREFERS_REDUCED_MOTION = new InjectionToken<Signal<boolean>>(
  'PREFERS_REDUCED_MOTION',
  {
    providedIn: 'root',
    factory: () => {
      const query = inject(DOCUMENT).defaultView?.matchMedia?.(REDUCED_MOTION_QUERY);
      const prefers = signal(query?.matches ?? false);
      if (query) {
        const follow = (): void => prefers.set(query.matches);
        query.addEventListener('change', follow);
        inject(DestroyRef).onDestroy(() => query.removeEventListener('change', follow));
      }
      return prefers.asReadonly();
    },
  },
);
