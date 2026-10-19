import { Component, computed, input } from '@angular/core';
import { travelBearing } from '../../../domain/units';

/**
 * An arrow pointing the way wind, waves or a current travel. Forecasts give the direction they come
 * from, so `from` is that bearing and the arrow turns half a circle from it. It draws nothing when
 * the forecast has no direction. Decorative: the text beside it names the direction.
 *
 * ```html
 * <glassy-direction-arrow [from]="windDirection" />
 * ```
 */
@Component({
  selector: 'glassy-direction-arrow',
  template: `
    @if (rotation(); as rotation) {
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" [style.transform]="rotation">
        <path d="M12 2l6.5 9H14v11h-4V11H5.5z" fill="currentColor" />
      </svg>
    }
  `,
  styles: `
    :host {
      display: inline-block;
      width: 1em;
      height: 1em;
      vertical-align: -0.15em;
    }

    svg {
      display: block;
      width: 100%;
      height: 100%;
    }
  `,
})
export class DirectionArrowComponent {
  /** Compass bearing the wind, waves or current come from, degrees. */
  readonly from = input.required<number>();

  protected readonly rotation = computed(() => {
    const from = this.from();
    return Number.isFinite(from) ? `rotate(${Math.round(travelBearing(from))}deg)` : null;
  });
}
