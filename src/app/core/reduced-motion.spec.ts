import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { PREFERS_REDUCED_MOTION, REDUCED_MOTION_QUERY } from './reduced-motion';

/** A media query list whose answer a test can change, like the user flipping the setting. */
class FakeMediaQuery extends EventTarget {
  constructor(public matches: boolean) {
    super();
  }

  flip(matches: boolean): void {
    this.matches = matches;
    this.dispatchEvent(new Event('change'));
  }
}

describe('PREFERS_REDUCED_MOTION', () => {
  function withMedia(query: FakeMediaQuery | undefined): ReturnType<typeof vi.fn> {
    const matchMedia = vi.fn(() => query);
    const document = { defaultView: query ? { matchMedia } : {} };
    TestBed.configureTestingModule({ providers: [{ provide: DOCUMENT, useValue: document }] });
    return matchMedia;
  }

  it('reads the reduce motion setting', () => {
    const matchMedia = withMedia(new FakeMediaQuery(true));
    expect(TestBed.inject(PREFERS_REDUCED_MOTION)()).toBe(true);
    expect(matchMedia).toHaveBeenCalledWith(REDUCED_MOTION_QUERY);
  });

  it('follows the setting when it changes', () => {
    const query = new FakeMediaQuery(false);
    withMedia(query);
    const prefers = TestBed.inject(PREFERS_REDUCED_MOTION);
    expect(prefers()).toBe(false);

    query.flip(true);
    expect(prefers()).toBe(true);
    query.flip(false);
    expect(prefers()).toBe(false);
  });

  it('allows motion where the browser cannot tell', () => {
    withMedia(undefined);
    expect(TestBed.inject(PREFERS_REDUCED_MOTION)()).toBe(false);
  });

  it('stops listening when the app is destroyed', () => {
    const query = new FakeMediaQuery(false);
    const listen = vi.spyOn(query, 'addEventListener');
    const unlisten = vi.spyOn(query, 'removeEventListener');
    withMedia(query);
    TestBed.inject(PREFERS_REDUCED_MOTION);
    const follow = listen.mock.calls[0]?.[1];

    TestBed.resetTestingModule();
    expect(unlisten).toHaveBeenCalledWith('change', follow);
  });
});
