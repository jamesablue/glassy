/** Tiles that fail in a row before a source counts as down. */
export const TILE_FAILURES_BEFORE_PAUSE = 6;
/** How long a source that is down is left alone before its tiles are asked for again, ms. */
export const TILE_PAUSE_MS = 30_000;

/**
 * Whether one tile source (the basemap, the place names, the land relief or the depth tiles) is
 * answering.
 *
 * Every tile of a source that is down fails, and the browser logs each failed request, so a single
 * outage would fill the console and keep hammering the server with every pan. After
 * {@link TILE_FAILURES_BEFORE_PAUSE} failures in a row the source is paused for
 * {@link TILE_PAUSE_MS}: its layer shows blank tiles without asking, `onOutage` runs once, and
 * the map carries on with whatever else it has. The next tiles after the pause try the source again.
 */
export class TileOutage {
  private failures = 0;
  private pausedUntil = -Infinity;

  /**
   * @param onOutage called each time the source goes down
   * @param now the current time, Unix ms
   */
  constructor(
    private readonly onOutage: () => void,
    private readonly now: () => number,
  ) {}

  /** Whether tiles should be skipped rather than asked for right now. */
  get paused(): boolean {
    return this.now() < this.pausedUntil;
  }

  /** A tile failed to load. */
  failed(): void {
    if (this.paused) return;
    this.failures++;
    if (this.failures < TILE_FAILURES_BEFORE_PAUSE) return;
    this.failures = 0;
    this.pausedUntil = this.now() + TILE_PAUSE_MS;
    this.onOutage();
  }

  /** A tile loaded, so the source is answering. */
  loaded(): void {
    this.failures = 0;
  }
}
