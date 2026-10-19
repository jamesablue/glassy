import type { Provider } from '@angular/core';
import { of } from 'rxjs';
import { CLOCK, type Clock } from '../app/core/clock';
import { ForecastRepository, type ForecastResult } from '../app/data/forecast.repository';
import type { ForecastBundle } from '../app/domain/models';

/** A clock that stays where a test puts it. */
export class FakeClock implements Clock {
  constructor(public time: number) {}

  now(): number {
    return this.time;
  }
}

/**
 * Providers for testing the stores against a known forecast: the repository answers every load
 * with `bundle` straight from the network, and the clock stands still at `now` (Unix ms).
 */
export function provideTestForecast(bundle: ForecastBundle, now: number): Provider[] {
  const result: ForecastResult = { bundle, fetchedAt: now, source: 'network' };
  return [
    { provide: ForecastRepository, useValue: { load: () => of(result) } },
    { provide: CLOCK, useValue: new FakeClock(now) },
  ];
}
