import type { Page } from '@playwright/test';

/** 8:30 AM on Sunday 18 October 2026 in Honolulu: hour 8 of the recorded forecast. */
export const RECORDED_MORNING = new Date(Date.UTC(2026, 9, 18, 18, 30));
/** The forecast hour that contains {@link RECORDED_MORNING}. */
export const RECORDED_MORNING_HOUR = 8;

/**
 * Starts the page's clock at {@link RECORDED_MORNING}, inside the recorded forecast, so "now", the
 * opening hour and the ranking are the same whatever day the tests run. Time then flows normally,
 * so animations (map flights, particles) still finish.
 */
export async function startAtRecordedMorning(page: Page): Promise<void> {
  await page.clock.install({ time: RECORDED_MORNING });
}
