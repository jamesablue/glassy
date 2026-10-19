import { Component, computed, input } from '@angular/core';
import { BEST_WINDOW_HOURS, rateScore, type BestWindow } from '../../domain/scoring';
import { hourRangeLabel } from '../../domain/time';

const SECONDS_PER_HOUR = 3600;

/**
 * The best daylight session still ahead, for example "Best daylight window: Sat 9 AM–12 PM ·
 * score 7.4 (good)", or a note that none is left in the forecast.
 */
@Component({
  selector: 'glassy-best-window',
  template: `
    @if (summary(); as summary) {
      Best daylight window: <b>{{ summary.range }}</b> · score {{ summary.score }} ({{
        summary.rating
      }})
    } @else {
      No daylight window left in this forecast.
    }
  `,
  styles: `
    :host {
      display: block;
      margin-top: 6px;
      color: var(--muted);
      font-size: 12px;
    }

    b {
      color: var(--text);
    }
  `,
})
export class BestWindowComponent {
  /** The window from `bestWindow`, or `null` when none fits. */
  readonly window = input.required<BestWindow | null>();
  /** Start of each forecast hour, Unix seconds. */
  readonly times = input.required<readonly number[]>();

  protected readonly summary = computed(() => {
    const window = this.window();
    const start = window ? this.times()[window.start] : undefined;
    if (!window || start === undefined) return null;
    return {
      range: hourRangeLabel(start, start + BEST_WINDOW_HOURS * SECONDS_PER_HOUR),
      score: window.average.toFixed(1),
      rating: rateScore(window.average).label.toLowerCase(),
    };
  });
}
