import {
  appNotice,
  forecastNotice,
  loadErrorMessage,
  MAP_OVERLAY_UNAVAILABLE,
  mapLayersPending,
  NOTICE_AUTO_HIDE_MS,
  sameNotice,
  type ForecastState,
} from './notices';

describe('forecastNotice', () => {
  /** 3 PM on Sunday 18 October 2026 in Honolulu. */
  const SUNDAY_3PM = Date.UTC(2026, 9, 19, 1);
  const state = (changes: Partial<ForecastState>): ForecastState => ({
    status: 'ready',
    rateLimited: false,
    fetchedAt: SUNDAY_3PM,
    online: true,
    gridStatus: 'ready',
    ...changes,
  });

  it('has nothing to say when the forecast is fresh, or while the first one loads', () => {
    expect(forecastNotice(state({}))).toBeNull();
    expect(forecastNotice(state({ status: 'loading', fetchedAt: undefined }))).toBeNull();
  });

  it('says a forecast on show is being refreshed', () => {
    expect(forecastNotice(state({ status: 'loading' }))).toEqual({
      message: 'Refreshing the forecast…',
      actionLabel: null,
      urgent: false,
      autoHideMs: null,
    });
  });

  it('says how old a stale forecast is, politely, and goes away on its own', () => {
    expect(forecastNotice(state({ status: 'stale' }))).toEqual({
      message: "Couldn't refresh the forecast. Showing data from Sun 3 PM.",
      actionLabel: null,
      urgent: false,
      autoHideMs: NOTICE_AUTO_HIDE_MS,
    });
    expect(forecastNotice(state({ status: 'stale', fetchedAt: undefined }))?.message).toBe(
      "Couldn't refresh the forecast. Showing an older one.",
    );
  });

  it('says when the forecast on show is all there is while offline', () => {
    const expected = {
      message:
        "You're offline. Showing the forecast from Sun 3 PM; it refreshes when you're back online.",
      actionLabel: null,
      urgent: false,
      autoHideMs: NOTICE_AUTO_HIDE_MS,
    };
    expect(forecastNotice(state({ online: false }))).toEqual(expected);
    expect(forecastNotice(state({ status: 'stale', online: false }))).toEqual(expected);
    expect(
      forecastNotice(state({ status: 'stale', online: false, fetchedAt: undefined }))?.message,
    ).toBe("You're offline. The forecast refreshes when you're back online.");
  });

  it('has nothing to say while the map grid is on its way', () => {
    expect(forecastNotice(state({ gridStatus: 'loading' }))).toBeNull();
  });

  it('says politely when the map overlay could not be loaded, then goes away', () => {
    expect(forecastNotice(state({ gridStatus: 'failed' }))).toEqual({
      message: MAP_OVERLAY_UNAVAILABLE,
      actionLabel: null,
      urgent: false,
      autoHideMs: NOTICE_AUTO_HIDE_MS,
    });
    expect(MAP_OVERLAY_UNAVAILABLE).toMatch(/^Map overlay unavailable/);
    // Being offline explains it better.
    expect(forecastNotice(state({ gridStatus: 'failed', online: false }))?.message).toMatch(
      /^You're offline/,
    );
  });

  it('offers a retry when nothing could be loaded', () => {
    expect(forecastNotice(state({ status: 'error', fetchedAt: undefined }))).toEqual({
      message: "Couldn't load the forecast. Check your connection and try again.",
      actionLabel: 'Retry',
      urgent: true,
      autoHideMs: null,
    });
  });

  it('offers a retry when a refresh failed with the forecast still on show', () => {
    expect(forecastNotice(state({ status: 'error' }))?.message).toBe(
      "Couldn't refresh the forecast. Check your connection and try again.",
    );
  });

  it('asks for patience when Open-Meteo is rate limiting', () => {
    expect(forecastNotice(state({ status: 'error', rateLimited: true }))).toMatchObject({
      message: 'The forecast service is getting too many requests. Try again in a minute.',
      actionLabel: 'Retry',
    });
  });

  it('blames the connection when the browser is offline', () => {
    expect(forecastNotice(state({ status: 'error', online: false }))).toMatchObject({
      message: "You're offline. The forecast loads when you're back online.",
      actionLabel: 'Retry',
      urgent: true,
    });
  });
});

describe('mapLayersPending', () => {
  const state = (changes: Partial<ForecastState>): ForecastState => ({
    status: 'ready',
    rateLimited: false,
    fetchedAt: Date.UTC(2026, 9, 19, 1),
    online: true,
    gridStatus: 'loading',
    ...changes,
  });

  it('is pending while a fresh spot forecast waits for its grid', () => {
    expect(mapLayersPending(state({}))).toBe(true);
  });

  it.each([
    ['the grid is in', { gridStatus: 'ready' }],
    ['the grid failed', { gridStatus: 'failed' }],
    ['nothing is on show yet', { status: 'loading', gridStatus: undefined }],
    ['a reload is under way', { status: 'loading' }],
    ['the reload failed', { status: 'error' }],
  ] as const)('is not pending when %s', (_, changes) => {
    expect(mapLayersPending(state(changes))).toBe(false);
  });
});

describe('loadErrorMessage', () => {
  it('explains a failed first load', () => {
    expect(loadErrorMessage(false, true)).toEqual({
      title: "Couldn't load the forecast",
      detail: 'Check your connection and try again.',
    });
  });

  it('explains the rate limit', () => {
    expect(loadErrorMessage(true, true)).toEqual({
      title: 'The forecast service is busy',
      detail: 'Open-Meteo is getting too many requests right now. Try again in a minute.',
    });
  });

  it('puts being offline first', () => {
    expect(loadErrorMessage(true, false)).toEqual({
      title: "You're offline",
      detail: 'The forecast loads by itself when you’re back online.',
    });
  });
});

describe('appNotice', () => {
  it('says the map tiles are missing but the forecast works', () => {
    expect(appNotice('map-tiles-unavailable')).toEqual({
      message: "Map tiles aren't loading right now. The forecast still works.",
      actionLabel: null,
      urgent: false,
      autoHideMs: NOTICE_AUTO_HIDE_MS,
    });
  });

  it('owns up to an unexpected error without any of its details', () => {
    expect(appNotice('unexpected-error')).toMatchObject({
      message: 'Something went wrong. If the map stops responding, reload the page.',
      urgent: false,
    });
  });
});

describe('sameNotice', () => {
  const error: ForecastState = {
    status: 'error',
    rateLimited: false,
    fetchedAt: undefined,
    online: true,
    gridStatus: undefined,
  };

  it('compares what the notices say', () => {
    expect(sameNotice(forecastNotice(error), forecastNotice({ ...error }))).toBe(true);
    expect(sameNotice(forecastNotice(error), forecastNotice({ ...error, rateLimited: true }))).toBe(
      false,
    );
    expect(sameNotice(null, null)).toBe(true);
    expect(sameNotice(null, forecastNotice(error))).toBe(false);
  });
});
