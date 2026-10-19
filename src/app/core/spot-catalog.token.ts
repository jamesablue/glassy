import { InjectionToken } from '@angular/core';
import type { Spot } from '../domain/models';
import { OAHU_SPOTS } from '../domain/spots';

/**
 * The spots the app forecasts and ranks, in a fixed order that every per-spot series follows.
 * Defaults to Oahu; another island plugs in by providing its own catalog.
 */
export const SPOT_CATALOG = new InjectionToken<readonly Spot[]>('SPOT_CATALOG', {
  providedIn: 'root',
  factory: () => OAHU_SPOTS,
});
