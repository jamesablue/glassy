import { TestBed, type ComponentFixture } from '@angular/core/testing';
import {
  RECORDED_MORNING,
  RECORDED_MORNING_HOUR,
  recordedForecastBundle,
} from '../../../testing/forecast-bundle';
import { provideTestForecast } from '../../../testing/state-providers';
import { rateScore } from '../../domain/scoring';
import { OAHU_SPOTS } from '../../domain/spots';
import { ConditionsStore, MapUiStore, PLAYBACK_INTERVAL_MS, TimelineStore } from '../../state';
import type { RankedSpot } from '../../state';
import {
  hourAnnouncement,
  HourAnnouncerComponent,
  PLAYBACK_ANNOUNCEMENT_GAP_MS,
  STEP_ANNOUNCEMENT_GAP_MS,
} from './hour-announcer.component';

describe('hourAnnouncement', () => {
  /** 9 AM on Monday 19 October 2026 in Honolulu. */
  const MONDAY_9AM = Date.UTC(2026, 9, 19, 19) / 1000;
  const spot = OAHU_SPOTS.find((candidate) => candidate.id === 'hanauma');
  if (!spot) throw new Error('No Hanauma Bay');
  const best = {
    spot,
    rank: 1,
    rating: rateScore(7.44),
    conditions: { score: 7.44 },
  } as unknown as RankedSpot;

  it('names the hour and the best spot with its rating and score', () => {
    expect(hourAnnouncement(MONDAY_9AM, true, best, 'all')).toBe(
      'Mon 9 AM. Best snorkeling: Hanauma Bay, Good, score 7.4 of 10.',
    );
  });

  it('says when it is dark and which coast the ranking covers', () => {
    expect(hourAnnouncement(MONDAY_9AM, false, best, 'South Shore')).toBe(
      'Mon 9 AM, after dark. Best snorkeling on the South Shore: Hanauma Bay, Good, score 7.4 of 10.',
    );
  });

  it('names just the hour when nothing is ranked', () => {
    expect(hourAnnouncement(MONDAY_9AM, true, undefined, 'all')).toBe('Mon 9 AM.');
  });
});

describe('HourAnnouncerComponent', () => {
  let fixture: ComponentFixture<HourAnnouncerComponent>;
  let element: HTMLElement;
  let timeline: TimelineStore;

  beforeEach(() => {
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'performance'],
    });
    TestBed.configureTestingModule({
      providers: provideTestForecast(recordedForecastBundle(), RECORDED_MORNING),
    });
    fixture = TestBed.createComponent(HourAnnouncerComponent);
    element = fixture.nativeElement as HTMLElement;
    timeline = TestBed.inject(TimelineStore);
    TestBed.tick();
  });

  afterEach(() => {
    timeline.pause();
    vi.useRealTimers();
  });

  /** What the region says now. */
  const said = (): string => element.textContent ?? '';
  const settle = (): void => {
    TestBed.tick();
  };
  /** What it should say for the hour on show. */
  const expected = (): string =>
    hourAnnouncement(
      timeline.selectedTime() ?? 0,
      timeline.isDaylight(),
      TestBed.inject(ConditionsStore).rankedSpots()[0],
      TestBed.inject(MapUiStore).regionFilter(),
    );

  it('is a polite live region that screen readers hear but nobody sees', () => {
    expect(element.getAttribute('role')).toBe('status');
    expect(element.classList.contains('visually-hidden')).toBe(true);
  });

  it('says nothing about the opening hour', () => {
    expect(timeline.selectedHour()).toBe(RECORDED_MORNING_HOUR);
    expect(said()).toBe('');
  });

  it('announces the new hour and its best spot', () => {
    timeline.step(1);
    settle();
    expect(said()).toBe(expected());
    expect(said()).toMatch(/^Sun 9 AM\. Best snorkeling: .+, score \d+\.\d of 10\.$/);
  });

  it('waits for the timeline to stop before announcing again', () => {
    timeline.step(1);
    settle();
    for (let i = 0; i < 5; i++) {
      timeline.step(1);
      settle();
    }
    expect(said()).toMatch(/^Sun 9 AM/);

    vi.advanceTimersByTime(STEP_ANNOUNCEMENT_GAP_MS);
    settle();
    expect(said()).toMatch(/^Sun 2 PM/);
    expect(said()).toBe(expected());
  });

  it('announces rarely during playback', () => {
    timeline.play();
    const steps = PLAYBACK_ANNOUNCEMENT_GAP_MS / PLAYBACK_INTERVAL_MS;
    const announcements = new Set<string>();
    for (let i = 0; i < steps * 2; i++) {
      vi.advanceTimersByTime(PLAYBACK_INTERVAL_MS);
      settle();
      if (said()) announcements.add(said());
    }
    // About 22 hours went by; two or three of them were announced.
    expect(announcements.size).toBeLessThanOrEqual(3);
    expect(announcements.size).toBeGreaterThanOrEqual(2);
  });

  it('drops a waiting announcement when it goes away', () => {
    timeline.step(1);
    settle();
    timeline.step(1);
    settle();
    fixture.destroy();
    expect(vi.getTimerCount()).toBe(0);
  });
});
