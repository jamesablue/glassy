import { forecastNotice, NOTICE_AUTO_HIDE_MS, sameNotice } from './forecast-notice';

describe('forecastNotice', () => {
  /** 3 PM on Sunday 18 October 2026 in Honolulu. */
  const SUNDAY_3PM = Date.UTC(2026, 9, 19, 1);

  it('has nothing to say while loading or when the forecast is fresh', () => {
    expect(forecastNotice('loading', false, undefined)).toBeNull();
    expect(forecastNotice('ready', false, SUNDAY_3PM)).toBeNull();
  });

  it('says how old a stale forecast is, politely, and goes away on its own', () => {
    expect(forecastNotice('stale', false, SUNDAY_3PM)).toEqual({
      message: "Couldn't refresh the forecast. Showing data from Sun 3 PM.",
      actionLabel: null,
      urgent: false,
      autoHideMs: NOTICE_AUTO_HIDE_MS,
    });
    expect(forecastNotice('stale', true, undefined)?.message).toBe(
      "Couldn't refresh the forecast. Showing an older one.",
    );
  });

  it('offers a retry when nothing could be loaded', () => {
    expect(forecastNotice('error', false, undefined)).toEqual({
      message: "Couldn't load the forecast. Check your connection and try again.",
      actionLabel: 'Retry',
      urgent: true,
      autoHideMs: null,
    });
  });

  it('asks for patience when Open-Meteo is rate limiting', () => {
    expect(forecastNotice('error', true, undefined)).toMatchObject({
      message: 'The forecast service is getting too many requests. Try again in a minute.',
      actionLabel: 'Retry',
    });
  });
});

describe('sameNotice', () => {
  it('compares what the notices say', () => {
    expect(
      sameNotice(forecastNotice('error', false, undefined), forecastNotice('error', false, 1)),
    ).toBe(true);
    expect(
      sameNotice(forecastNotice('error', false, undefined), forecastNotice('error', true, 1)),
    ).toBe(false);
    expect(sameNotice(null, null)).toBe(true);
    expect(sameNotice(null, forecastNotice('error', false, undefined))).toBe(false);
  });
});
