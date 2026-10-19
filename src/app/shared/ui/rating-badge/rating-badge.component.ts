import { Component, input } from '@angular/core';
import type { Rating } from '../../../domain/models';

/**
 * A rating's name on its colour, for example a green "Excellent". The colours are all light, so the
 * text is always dark.
 */
@Component({
  selector: 'glassy-rating-badge',
  template: '{{ rating().label }}',
  host: { '[style.--rating-color]': 'rating().color' },
  styles: `
    :host {
      display: inline-block;
      padding: 5px 10px;
      border-radius: 7px;
      background: var(--rating-color);
      color: var(--on-light);
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.4px;
      text-transform: uppercase;
    }
  `,
})
export class RatingBadgeComponent {
  readonly rating = input.required<Rating>();
}
