import { AnnouncementThrottle } from './announcement-throttle';

describe('AnnouncementThrottle', () => {
  let heard: string[];
  let throttle: AnnouncementThrottle;

  beforeEach(() => {
    vi.useFakeTimers();
    heard = [];
    throttle = new AnnouncementThrottle(
      (message) => heard.push(message),
      () => Date.now(),
    );
  });

  afterEach(() => {
    throttle.cancel();
    vi.useRealTimers();
  });

  it('announces the first message at once', () => {
    throttle.push('Sun 9 AM', 1000);
    expect(heard).toEqual(['Sun 9 AM']);
  });

  it('holds back a burst and then announces only where it ended', () => {
    throttle.push('Sun 9 AM', 1000);
    vi.advanceTimersByTime(100);
    throttle.push('Sun 10 AM', 1000);
    vi.advanceTimersByTime(100);
    throttle.push('Sun 11 AM', 1000);
    expect(heard).toEqual(['Sun 9 AM']);

    vi.advanceTimersByTime(799);
    expect(heard).toEqual(['Sun 9 AM']);
    vi.advanceTimersByTime(1);
    expect(heard).toEqual(['Sun 9 AM', 'Sun 11 AM']);
  });

  it('announces at once again after a quiet spell', () => {
    throttle.push('Sun 9 AM', 1000);
    vi.advanceTimersByTime(1500);
    throttle.push('Sun 10 AM', 1000);
    expect(heard).toEqual(['Sun 9 AM', 'Sun 10 AM']);
  });

  it('spaces announcements by the gap it is given, for example during playback', () => {
    // A new hour every 450 ms for 5.4 s, announced at most every 5 s.
    throttle.push('Sun 9', 5000);
    for (let hour = 10; hour < 22; hour++) {
      vi.advanceTimersByTime(450);
      throttle.push(`Sun ${hour}`, 5000);
    }
    vi.advanceTimersByTime(10_000);
    expect(heard).toEqual(['Sun 9', 'Sun 20', 'Sun 21']);
  });

  it('drops a waiting message when cancelled', () => {
    throttle.push('Sun 9 AM', 1000);
    throttle.push('Sun 10 AM', 1000);
    throttle.cancel();
    vi.advanceTimersByTime(5000);
    expect(heard).toEqual(['Sun 9 AM']);
  });

  it('keeps time with the browser’s clock by default', () => {
    const fallback = new AnnouncementThrottle((message) => heard.push(message));
    fallback.push('Sun 9 AM', 1000);
    expect(heard).toEqual(['Sun 9 AM']);
    fallback.cancel();
  });
});
