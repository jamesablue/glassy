import { Component, computed, input } from '@angular/core';
import { rateScore } from '../../../domain/scoring';

/**
 * A snorkel score to one decimal over its rating, on the rating's colour: the compact form the
 * ranking uses. Screen readers hear "score 7.4 of 10, Good".
 */
@Component({
  selector: 'glassy-score-pill',
  template: `
    <span class="visually-hidden">score</span>
    {{ text() }}
    <span class="visually-hidden">of 10, </span>
    <small>{{ rating().label }}</small>
  `,
  host: { '[style.--rating-color]': 'rating().color' },
  styles: `
    :host {
      display: block;
      min-width: 46px;
      padding: 3px 7px;
      border-radius: 6px;
      background: var(--rating-color);
      color: var(--on-light);
      font-size: 12.5px;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      text-align: center;
    }

    small {
      display: block;
      margin-top: -2px;
      font-size: 9.5px;
      font-weight: 600;
      letter-spacing: 0.3px;
      text-transform: uppercase;
      // Softer than the score, still at least 5:1 on every rating colour.
      opacity: 0.85;
    }
  `,
})
export class ScorePillComponent {
  /** Snorkel score from 0 to 10. */
  readonly score = input.required<number>();

  protected readonly rating = computed(() => rateScore(this.score()));
  protected readonly text = computed(() => this.score().toFixed(1));
}
