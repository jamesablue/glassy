import { inputBinding, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { BestWindow } from '../../domain/scoring';
import { BestWindowComponent } from './best-window.component';

describe('BestWindowComponent', () => {
  /** Midnight on Sunday 18 October 2026 in Honolulu, then hourly. */
  const TIMES = Array.from(
    { length: 48 },
    (_, hour) => Date.UTC(2026, 9, 18, 10) / 1000 + hour * 3600,
  );

  async function render(window: BestWindow | null): Promise<string> {
    const fixture = TestBed.createComponent(BestWindowComponent, {
      bindings: [inputBinding('window', signal(window)), inputBinding('times', () => TIMES)],
    });
    await fixture.whenStable();
    return (fixture.nativeElement as HTMLElement).textContent?.replace(/\s+/g, ' ').trim() ?? '';
  }

  it('names the best daylight session ahead, its average score and rating', async () => {
    expect(await render({ start: 33, average: 7.44 })).toBe(
      'Best daylight window: Mon 9 AM–12 PM · score 7.4 (good)',
    );
  });

  it('says so when no daylight window is left', async () => {
    expect(await render(null)).toBe('No daylight window left in this forecast.');
  });
});
