import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { recordedForecastBundle, testForecastBundle } from '../../testing/forecast-bundle';
import { FakeClock } from '../../testing/state-providers';
import { CLOCK } from '../core/clock';
import { ForecastRepository, type ForecastResult } from '../data/forecast.repository';
import type { ForecastBundle } from '../domain/models';
import { ForecastStore } from './forecast.store';
import { PLAYBACK_INTERVAL_MS, TimelineStore } from './timeline.store';

const HOUR_MS = 3_600_000;
/** The recorded forecast starts at midnight on Sunday 18 October 2026 in Honolulu (10:00 UTC). */
const MIDNIGHT = Date.UTC(2026, 9, 18, 10);
/** 8:30 AM on the first day: hour 8. */
const MORNING = MIDNIGHT + 8.5 * HOUR_MS;

describe('TimelineStore', () => {
  const recorded = recordedForecastBundle();
  const LAST = recorded.times.length - 1;

  /** Creates the store with the clock at `now`, answering each load with the next bundle. */
  function setup(now: number, ...bundles: ForecastBundle[]): TimelineStore {
    const results = bundles.map((bundle): ForecastResult => ({
      bundle,
      fetchedAt: now,
      source: 'network',
    }));
    // The last bundle answers every later load.
    const load = vi.fn(() => of(results.length > 1 ? results.shift() : results[0]));
    TestBed.configureTestingModule({
      providers: [
        { provide: ForecastRepository, useValue: { load } },
        { provide: CLOCK, useValue: new FakeClock(now) },
      ],
    });
    return TestBed.inject(TimelineStore);
  }

  async function loaded(): Promise<void> {
    TestBed.tick();
    await TestBed.inject(ApplicationRef).whenStable();
  }

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('before a forecast loads', () => {
    it('has no hours to select', () => {
      const timeline = setup(MORNING);
      expect(timeline.hourCount()).toBe(0);
      expect(timeline.selectedTime()).toBeUndefined();
      expect(timeline.days()).toEqual([]);
      expect(timeline.nights()).toEqual([]);
    });

    it('ignores seeking and playback', () => {
      const timeline = setup(MORNING);
      timeline.seek(5);
      timeline.play();
      expect(timeline.selectedHour()).toBe(0);
      expect(timeline.isPlaying()).toBe(false);
    });
  });

  describe('now', () => {
    it('opens on the hour that contains now', async () => {
      const timeline = setup(MORNING, recorded);
      await loaded();

      expect(timeline.hourCount()).toBe(48);
      expect(timeline.nowHour()).toBe(8);
      expect(timeline.selectedHour()).toBe(8);
      expect(timeline.selectedTime()).toBe(recorded.times[8]);
      expect(timeline.nowPosition()).toBe(8.5);
      expect(timeline.todayKey()).toBe('2026-10-18');
    });

    it('opens a forecast that is all in the past at its start, like the prototype', async () => {
      const timeline = setup(MIDNIGHT + 72 * HOUR_MS, recorded);
      await loaded();
      expect(timeline.nowHour()).toBe(0);
      expect(timeline.selectedHour()).toBe(0);
    });

    it('opens a forecast that has not started yet at its first hour', async () => {
      const timeline = setup(MIDNIGHT - 5 * HOUR_MS, recorded);
      await loaded();
      expect(timeline.nowHour()).toBe(0);
    });
  });

  it('knows whether the selected hour is in daylight', async () => {
    const timeline = setup(MORNING, recorded);
    expect(timeline.isDaylight()).toBe(true);
    await loaded();

    expect(timeline.isDaylight()).toBe(true);
    timeline.seek(2);
    expect(timeline.isDaylight()).toBe(false);
  });

  it('groups the hours into Honolulu days and finds the nights', async () => {
    const timeline = setup(MORNING, recorded);
    await loaded();

    expect(timeline.days()).toEqual([
      { dateKey: '2026-10-18', label: 'Sun 18', start: 0, count: 24 },
      { dateKey: '2026-10-19', label: 'Mon 19', start: 24, count: 24 },
    ]);
    expect(timeline.nights()).toEqual([
      { start: 0, count: 7 },
      { start: 19, count: 12 },
      { start: 43, count: 5 },
    ]);
  });

  describe('seeking', () => {
    let timeline: TimelineStore;

    beforeEach(async () => {
      timeline = setup(MORNING, recorded);
      await loaded();
    });

    it('selects an hour', () => {
      timeline.seek(30);
      expect(timeline.selectedHour()).toBe(30);
      expect(timeline.selectedTime()).toBe(recorded.times[30]);
    });

    it('clamps to the forecast', () => {
      timeline.seek(-3);
      expect(timeline.selectedHour()).toBe(0);
      timeline.seek(500);
      expect(timeline.selectedHour()).toBe(LAST);
    });

    it('drops fractions of an hour and ignores non-numbers', () => {
      timeline.seek(12.9);
      expect(timeline.selectedHour()).toBe(12);
      timeline.seek(Number.NaN);
      expect(timeline.selectedHour()).toBe(12);
    });

    it('steps forward and back within the forecast', () => {
      timeline.step(1);
      expect(timeline.selectedHour()).toBe(9);
      timeline.step(-3);
      expect(timeline.selectedHour()).toBe(6);
      timeline.step(-100);
      expect(timeline.selectedHour()).toBe(0);
    });

    it('goes back to now', () => {
      timeline.seek(40);
      timeline.goToNow();
      expect(timeline.selectedHour()).toBe(8);
    });

    it('finds the hour for a time and clamps times outside the forecast', () => {
      const seconds = (ms: number): number => ms / 1000;
      timeline.seekToTime(seconds(MIDNIGHT + 20.75 * HOUR_MS));
      expect(timeline.selectedHour()).toBe(20);
      timeline.seekToTime(seconds(MIDNIGHT - 48 * HOUR_MS));
      expect(timeline.selectedHour()).toBe(0);
      timeline.seekToTime(seconds(MIDNIGHT + 480 * HOUR_MS));
      expect(timeline.selectedHour()).toBe(LAST);
    });
  });

  describe('playback', () => {
    let timeline: TimelineStore;

    beforeEach(async () => {
      timeline = setup(MORNING, recorded);
      await loaded();
      vi.useFakeTimers();
    });

    it('advances one hour every 450 ms', () => {
      timeline.play();
      expect(timeline.isPlaying()).toBe(true);

      vi.advanceTimersByTime(PLAYBACK_INTERVAL_MS - 1);
      expect(timeline.selectedHour()).toBe(8);
      vi.advanceTimersByTime(1);
      expect(timeline.selectedHour()).toBe(9);
      vi.advanceTimersByTime(3 * PLAYBACK_INTERVAL_MS);
      expect(timeline.selectedHour()).toBe(12);
    });

    it('wraps from the last hour back to now', () => {
      timeline.seek(LAST - 1);
      timeline.play();
      vi.advanceTimersByTime(PLAYBACK_INTERVAL_MS);
      expect(timeline.selectedHour()).toBe(LAST);
      vi.advanceTimersByTime(PLAYBACK_INTERVAL_MS);
      expect(timeline.selectedHour()).toBe(8);
      expect(timeline.isPlaying()).toBe(true);
    });

    it('pauses', () => {
      timeline.play();
      vi.advanceTimersByTime(PLAYBACK_INTERVAL_MS);
      timeline.pause();
      vi.advanceTimersByTime(10 * PLAYBACK_INTERVAL_MS);

      expect(timeline.isPlaying()).toBe(false);
      expect(timeline.selectedHour()).toBe(9);
      expect(vi.getTimerCount()).toBe(0);
    });

    it('toggles', () => {
      timeline.togglePlay();
      expect(timeline.isPlaying()).toBe(true);
      timeline.togglePlay();
      expect(timeline.isPlaying()).toBe(false);
    });

    it('does not speed up when asked to play twice', () => {
      timeline.play();
      timeline.play();
      vi.advanceTimersByTime(PLAYBACK_INTERVAL_MS);
      expect(timeline.selectedHour()).toBe(9);
      expect(vi.getTimerCount()).toBe(1);
    });

    it.each([
      ['seeking', (store: TimelineStore) => store.seek(20)],
      ['stepping', (store: TimelineStore) => store.step(1)],
      ['going to now', (store: TimelineStore) => store.goToNow()],
    ])('stops when %s', (_, move) => {
      timeline.play();
      move(timeline);
      expect(timeline.isPlaying()).toBe(false);
      expect(vi.getTimerCount()).toBe(0);
    });

    it('stops when the app is destroyed', () => {
      timeline.play();
      TestBed.resetTestingModule();
      expect(vi.getTimerCount()).toBe(0);
    });
  });

  describe('when a reload brings a new forecast', () => {
    const START = 1_800_000_000;
    const first = testForecastBundle(6, START);
    /** The same forecast an hour later: its first hour is the old second hour. */
    const later = testForecastBundle(6, START + 3600);

    it('keeps the selected time when the new forecast has it', async () => {
      const timeline = setup(START * 1000, first, later);
      await loaded();
      timeline.seek(3);

      TestBed.inject(ForecastStore).reload();
      await loaded();

      expect(timeline.selectedTime()).toBe(START + 3 * 3600);
      expect(timeline.selectedHour()).toBe(2);
    });

    it('goes to now when the selected time has dropped out of the forecast', async () => {
      const timeline = setup((START + 2 * 3600) * 1000, first, later);
      await loaded();
      timeline.seek(0);

      TestBed.inject(ForecastStore).reload();
      await loaded();

      expect(timeline.selectedHour()).toBe(timeline.nowHour());
      expect(timeline.selectedTime()).toBe(START + 2 * 3600);
    });
  });
});
