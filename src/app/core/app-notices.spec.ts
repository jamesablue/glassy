import { TestBed } from '@angular/core/testing';
import { FakeClock } from '../../testing/state-providers';
import { APP_NOTICE_INTERVAL_MS, AppNotices } from './app-notices';
import { CLOCK } from './clock';

describe('AppNotices', () => {
  let clock: FakeClock;
  let notices: AppNotices;

  beforeEach(() => {
    clock = new FakeClock(Date.UTC(2026, 9, 18, 18));
    TestBed.configureTestingModule({ providers: [{ provide: CLOCK, useValue: clock }] });
    notices = TestBed.inject(AppNotices);
  });

  it('has nothing to say at first', () => {
    expect(notices.latest()).toBeNull();
  });

  it('raises a notice', () => {
    notices.raise('map-tiles-unavailable');
    expect(notices.latest()).toEqual({ kind: 'map-tiles-unavailable', id: 1 });
  });

  it('raises a kind once however often it is reported within the interval', () => {
    for (let i = 0; i < 40; i++) {
      clock.time += 1000;
      notices.raise('map-tiles-unavailable');
    }
    expect(notices.latest()).toEqual({ kind: 'map-tiles-unavailable', id: 1 });
  });

  it('raises it again once the interval has passed', () => {
    notices.raise('unexpected-error');
    clock.time += APP_NOTICE_INTERVAL_MS - 1;
    notices.raise('unexpected-error');
    expect(notices.latest()?.id).toBe(1);

    clock.time += 1;
    notices.raise('unexpected-error');
    expect(notices.latest()).toEqual({ kind: 'unexpected-error', id: 2 });
  });

  it('throttles each kind on its own', () => {
    notices.raise('map-tiles-unavailable');
    notices.raise('unexpected-error');
    expect(notices.latest()).toEqual({ kind: 'unexpected-error', id: 2 });
  });
});
