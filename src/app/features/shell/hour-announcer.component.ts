import { Component, DestroyRef, effect, inject, signal, untracked } from '@angular/core';
import { timeLabel } from '../../domain/time';
import {
  ConditionsStore,
  MapUiStore,
  TimelineStore,
  type RankedSpot,
  type RegionFilter,
} from '../../state';
import { AnnouncementThrottle } from './announcement-throttle';

/** The least time between announcements while the timeline is moved by hand, ms. */
export const STEP_ANNOUNCEMENT_GAP_MS = 1000;
/** The least time between announcements while the forecast plays, ms. */
export const PLAYBACK_ANNOUNCEMENT_GAP_MS = 5000;

/**
 * What screen readers hear when the hour changes: the hour, and the spot that ranks first then,
 * for example "Mon 9 AM. Best snorkeling: Hanauma Bay, Good, score 7.4 of 10."
 */
export function hourAnnouncement(
  time: number,
  daylight: boolean,
  best: RankedSpot | undefined,
  region: RegionFilter,
): string {
  const when = daylight ? timeLabel(time) : `${timeLabel(time)}, after dark`;
  if (!best) return `${when}.`;
  const where = region === 'all' ? '' : ` on the ${region}`;
  const score = best.conditions.score.toFixed(1);
  return `${when}. Best snorkeling${where}: ${best.spot.name}, ${best.rating.label}, score ${score} of 10.`;
}

/**
 * A polite live region that tells screen reader users what changed when the hour does: the new
 * hour and the spot that now ranks first. The ranking itself updates silently, and someone moving
 * the timeline from the keyboard would otherwise have to go and look.
 *
 * Announcements are spaced out (see {@link AnnouncementThrottle}): at most one a second while the
 * timeline is moved by hand, so holding an arrow key ends on the hour it stopped at, and one every
 * five seconds during playback, which changes the hour twice a second. The opening hour is not
 * announced; nothing has changed yet.
 */
@Component({
  selector: 'glassy-hour-announcer',
  template: '{{ message() }}',
  host: { role: 'status', class: 'visually-hidden' },
})
export class HourAnnouncerComponent {
  private readonly timeline = inject(TimelineStore);
  private readonly conditions = inject(ConditionsStore);
  private readonly mapUi = inject(MapUiStore);

  protected readonly message = signal('');

  constructor() {
    const throttle = new AnnouncementThrottle((message) => this.message.set(message));
    let previous: number | undefined;
    effect(() => {
      const hour = this.timeline.selectedHour();
      if (this.timeline.hourCount() === 0) return;
      const changed = previous !== undefined && hour !== previous;
      previous = hour;
      if (!changed) return;
      untracked(() => {
        const gap = this.timeline.isPlaying()
          ? PLAYBACK_ANNOUNCEMENT_GAP_MS
          : STEP_ANNOUNCEMENT_GAP_MS;
        throttle.push(this.describe(), gap);
      });
    });
    inject(DestroyRef).onDestroy(() => throttle.cancel());
  }

  private describe(): string {
    const time = this.timeline.selectedTime() ?? 0;
    return hourAnnouncement(
      time,
      this.timeline.isDaylight(),
      this.conditions.rankedSpots()[0],
      this.mapUi.regionFilter(),
    );
  }
}
