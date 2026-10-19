import { computed, DestroyRef, inject, Injectable, linkedSignal, signal } from '@angular/core';
import { CLOCK } from '../core/clock';
import { clamp } from '../domain/math';
import {
  currentHourIndex,
  dateKey,
  groupHoursByDay,
  hourIndexAt,
  nightRuns,
  nowPosition,
  type DayGroup,
  type HourRun,
} from '../domain/time';
import { ForecastStore } from './forecast.store';

/** How long playback shows each hour, ms. */
export const PLAYBACK_INTERVAL_MS = 450;

const MS_PER_SECOND = 1000;

/**
 * The forecast timeline: which hour is now, which hour is selected, and playback.
 *
 * "Now" is read from the clock each time a forecast arrives, as the prototype did on boot, rather
 * than on a timer. The timeline, the ranking and a shared link's `t` then agree on the current hour
 * until the next load, and tests control it through the `CLOCK` token.
 *
 * The selection starts at the current hour. When a reload brings a new forecast, the selection
 * keeps its time if the new forecast still has it, so a refresh does not move the timeline under
 * the user.
 */
@Injectable({ providedIn: 'root' })
export class TimelineStore {
  private readonly forecast = inject(ForecastStore);
  private readonly clock = inject(CLOCK);

  /** Start of each forecast hour, Unix seconds. Empty until a forecast loads. */
  readonly times = computed<readonly number[]>(() => this.forecast.bundle()?.times ?? []);
  readonly hourCount = computed(() => this.times().length);

  private readonly nowSeconds = computed(() => {
    this.times(); // Read the clock again for each new forecast.
    return this.clock.now() / MS_PER_SECOND;
  });

  /** Index of the forecast hour that contains now (the first hour if the forecast is all past). */
  readonly nowHour = computed(() => currentHourIndex(this.times(), this.nowSeconds()));
  /** Now in fractional hours, for placing the "now" marker between hour ticks. */
  readonly nowPosition = computed(() => nowPosition(this.times(), this.nowSeconds()));
  /** Today's Honolulu date, `YYYY-MM-DD`, comparable with each day's `dateKey`. */
  readonly todayKey = computed(() => dateKey(this.nowSeconds()));
  /** The forecast hours grouped into Honolulu calendar days, for the timeline's day labels. */
  readonly days = computed<readonly DayGroup[]>(() => groupHoursByDay(this.times()));
  /** Runs of night hours, for shading the timeline. */
  readonly nights = computed<readonly HourRun[]>(() =>
    nightRuns(this.forecast.bundle()?.isDay ?? []),
  );

  private readonly hour = linkedSignal<readonly number[], number>({
    source: this.times,
    computation: (times, previous) => {
      const selectedTime = previous?.source[previous.value];
      const kept = selectedTime === undefined ? -1 : times.indexOf(selectedTime);
      return kept >= 0 ? kept : this.nowHour();
    },
  });
  private readonly playing = signal(false);
  private playTimer: ReturnType<typeof setInterval> | undefined;

  readonly selectedHour = this.hour.asReadonly();
  /** Start of the selected hour, Unix seconds, or `undefined` before a forecast loads. */
  readonly selectedTime = computed<number | undefined>(() => this.times()[this.hour()]);
  /** Whether the selected hour is in daylight. Before a forecast loads there is no night to flag. */
  readonly isDaylight = computed(() => this.forecast.bundle()?.isDay[this.hour()] ?? true);
  readonly isPlaying = this.playing.asReadonly();

  constructor() {
    inject(DestroyRef).onDestroy(() => this.pause());
  }

  /** Selects an hour (clamped to the forecast) and stops playback. Ignored before data loads. */
  seek(hour: number): void {
    this.pause();
    const last = this.hourCount() - 1;
    if (last >= 0 && Number.isFinite(hour)) this.hour.set(clamp(Math.trunc(hour), 0, last));
  }

  /** Selects the hour that contains a time (Unix seconds), clamped to the forecast. */
  seekToTime(unixSeconds: number): void {
    this.seek(hourIndexAt(this.times(), unixSeconds));
  }

  /** Moves the selection by `delta` hours, for example `step(-1)` for the previous hour. */
  step(delta: number): void {
    this.seek(this.hour() + delta);
  }

  goToNow(): void {
    this.seek(this.nowHour());
  }

  /**
   * Steps through the forecast one hour every {@link PLAYBACK_INTERVAL_MS}, wrapping from the last
   * hour back to now. Does nothing before a forecast loads.
   */
  play(): void {
    if (this.playing() || this.hourCount() === 0) return;
    this.playing.set(true);
    this.playTimer = setInterval(() => this.advance(), PLAYBACK_INTERVAL_MS);
  }

  pause(): void {
    clearInterval(this.playTimer);
    this.playTimer = undefined;
    this.playing.set(false);
  }

  togglePlay(): void {
    if (this.playing()) this.pause();
    else this.play();
  }

  private advance(): void {
    const next = this.hour() + 1;
    this.hour.set(next < this.hourCount() ? next : this.nowHour());
  }
}
