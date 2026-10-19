import { TestBed } from '@angular/core/testing';
import { CLOCK } from './clock';

describe('CLOCK', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('reads the system clock by default', () => {
    vi.useFakeTimers();
    vi.setSystemTime(Date.UTC(2026, 9, 18, 20));
    expect(TestBed.inject(CLOCK).now()).toBe(Date.UTC(2026, 9, 18, 20));
  });

  it('can be replaced', () => {
    TestBed.configureTestingModule({
      providers: [{ provide: CLOCK, useValue: { now: () => 42 } }],
    });
    expect(TestBed.inject(CLOCK).now()).toBe(42);
  });
});
