import { TILE_FAILURES_BEFORE_PAUSE, TILE_PAUSE_MS, TileOutage } from './tile-outage';

describe('TileOutage', () => {
  let now: number;
  let outages: number;
  let outage: TileOutage;

  beforeEach(() => {
    now = 1_000_000;
    outages = 0;
    outage = new TileOutage(
      () => outages++,
      () => now,
    );
  });

  const fail = (times: number): void => {
    for (let i = 0; i < times; i++) outage.failed();
  };

  it('asks for tiles while the source answers', () => {
    expect(outage.paused).toBe(false);
  });

  it('puts up with a few failed tiles', () => {
    fail(TILE_FAILURES_BEFORE_PAUSE - 1);
    expect(outage.paused).toBe(false);
    expect(outages).toBe(0);
  });

  it('pauses the source and reports it once after enough failures in a row', () => {
    fail(TILE_FAILURES_BEFORE_PAUSE);
    expect(outage.paused).toBe(true);
    expect(outages).toBe(1);

    // Tiles already on their way keep failing; that is the same outage.
    fail(20);
    expect(outages).toBe(1);
  });

  it('starts counting again whenever a tile loads', () => {
    fail(TILE_FAILURES_BEFORE_PAUSE - 1);
    outage.loaded();
    fail(TILE_FAILURES_BEFORE_PAUSE - 1);
    expect(outage.paused).toBe(false);
  });

  it('tries the source again after the pause, and reports a new outage if it is still down', () => {
    fail(TILE_FAILURES_BEFORE_PAUSE);
    now += TILE_PAUSE_MS - 1;
    expect(outage.paused).toBe(true);
    now += 1;
    expect(outage.paused).toBe(false);

    fail(TILE_FAILURES_BEFORE_PAUSE);
    expect(outage.paused).toBe(true);
    expect(outages).toBe(2);
  });
});
