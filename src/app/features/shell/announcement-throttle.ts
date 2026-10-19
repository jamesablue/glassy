/**
 * Spaces out messages for a live region, so a screen reader is not talked over every time the
 * timeline moves.
 *
 * The first message goes out at once. Another one within `gapMs` of the last waits until the gap
 * has passed and then goes out, replaced by any newer one in the meantime, so the listener hears
 * where things ended up rather than every step on the way.
 */
export class AnnouncementThrottle {
  private lastAt = -Infinity;
  private waiting: string | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;

  /**
   * @param announce puts a message in the live region
   * @param now the current time, ms
   */
  constructor(
    private readonly announce: (message: string) => void,
    private readonly now: () => number = () => performance.now(),
  ) {}

  /** Announces `message` now, or once `gapMs` has passed since the last announcement. */
  push(message: string, gapMs: number): void {
    this.waiting = message;
    // Already waiting for the gap to pass: this message replaces the one that was going out.
    if (this.timer !== undefined) return;
    const wait = this.lastAt + gapMs - this.now();
    if (wait <= 0) this.flush();
    else this.timer = setTimeout(() => this.flush(), wait);
  }

  /** Drops anything waiting, for example when the page goes away. */
  cancel(): void {
    this.cancelTimer();
    this.waiting = null;
  }

  private flush(): void {
    this.timer = undefined;
    const message = this.waiting;
    if (message === null) return;
    this.waiting = null;
    this.lastAt = this.now();
    this.announce(message);
  }

  private cancelTimer(): void {
    clearTimeout(this.timer);
    this.timer = undefined;
  }
}
