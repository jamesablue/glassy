import { Component, computed, ElementRef, inject, viewChild } from '@angular/core';
import { timeLabel } from '../../domain/time';
import { IconComponent } from '../../shared/ui';
import { TimelineStore } from '../../state';
import { hourAtOffset, hourForKey, hourPercent } from './timeline-geometry';

/**
 * The forecast timeline along the bottom of the screen: play/pause, the days (today highlighted)
 * over a daylight strip with the nights shaded, progress up to the selected hour, a mark at the
 * current time, a handle labelled with the selected hour, and a button back to now.
 *
 * The track is an ARIA slider over the forecast hours. Click or drag anywhere on it to pick an hour;
 * from the keyboard, the arrows step an hour, Page Up and Page Down a day, Home and End go to the
 * ends. Any of these stops playback.
 */
@Component({
  selector: 'glassy-timeline',
  imports: [IconComponent],
  templateUrl: './timeline.component.html',
  styleUrl: './timeline.component.scss',
  host: { role: 'region', 'aria-label': 'Forecast timeline' },
})
export class TimelineComponent {
  private readonly timeline = inject(TimelineStore);

  protected readonly hourCount = this.timeline.hourCount;
  protected readonly hour = this.timeline.selectedHour;
  protected readonly maxHour = computed(() => Math.max(this.hourCount() - 1, 0));
  /** The selected hour, for example "Tue 5 PM"; also the slider's `aria-valuetext`. */
  protected readonly label = computed(() => {
    const time = this.timeline.selectedTime();
    return time === undefined ? '' : timeLabel(time);
  });
  protected readonly playLabel = computed(() =>
    this.timeline.isPlaying() ? 'Pause forecast' : 'Play forecast',
  );
  protected readonly playIcon = computed(() => (this.timeline.isPlaying() ? 'pause' : 'play'));

  protected readonly days = computed(() => {
    const count = this.hourCount();
    const today = this.timeline.todayKey();
    return this.timeline.days().map((day) => ({
      key: day.dateKey,
      label: day.label,
      isToday: day.dateKey === today,
      left: hourPercent(day.start, count),
      width: hourPercent(day.count, count),
    }));
  });
  protected readonly nights = computed(() => {
    const count = this.hourCount();
    return this.timeline.nights().map((night) => ({
      start: night.start,
      left: hourPercent(night.start, count),
      width: hourPercent(night.count, count),
    }));
  });
  /** The middle of the selected hour along the track, percent. */
  protected readonly position = computed(() => hourPercent(this.hour() + 0.5, this.hourCount()));
  protected readonly handlePosition = computed(() => `${this.position()}%`);
  protected readonly nowLeft = computed(() =>
    hourPercent(this.timeline.nowPosition(), this.hourCount()),
  );

  private readonly track = viewChild.required<ElementRef<HTMLElement>>('track');
  private dragging = false;

  protected togglePlay(): void {
    this.timeline.togglePlay();
  }

  protected goToNow(): void {
    this.timeline.goToNow();
  }

  protected onPointerDown(event: PointerEvent): void {
    if (this.hourCount() === 0) return;
    this.track().nativeElement.setPointerCapture(event.pointerId);
    this.dragging = true;
    this.seekTo(event.clientX);
  }

  protected onPointerMove(event: PointerEvent): void {
    if (this.dragging) this.seekTo(event.clientX);
  }

  protected onPointerEnd(): void {
    this.dragging = false;
  }

  protected onKeydown(event: KeyboardEvent): void {
    const target = hourForKey(event.key, this.hour(), this.hourCount());
    if (target === null || this.hourCount() === 0) return;
    // Handled here, so the app-wide arrow-key shortcuts leave it alone.
    event.preventDefault();
    this.timeline.seek(target);
  }

  private seekTo(clientX: number): void {
    const box = this.track().nativeElement.getBoundingClientRect();
    const hour = hourAtOffset(clientX - box.left, box.width, this.hourCount());
    if (hour !== this.hour()) this.timeline.seek(hour);
    else this.timeline.pause();
  }
}
