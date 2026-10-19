import { Component, computed, input, output } from '@angular/core';
import type { LabelMode } from '../../../domain/geo';
import type { HeightUnit } from '../../../domain/models';
import { rateScore } from '../../../domain/scoring';
import { surfText } from '../../../domain/units';
import type { SpotPin } from '../../../state';

/**
 * One spot on the map: a dot in the rating's colour with a tag showing the surf height and the spot
 * name. `mode` says how much of the tag fits without overlapping its neighbours (see
 * `placeLabels`); hovering or focusing a pin shows its tag in full, and so does `hovered`, which is
 * set while the spot's row in the ranking is hovered.
 *
 * It is a real button, so pins are reachable with Tab and selected with Enter or Space, and screen
 * readers hear the name, rating and surf.
 */
@Component({
  selector: 'glassy-spot-pin',
  template: `
    <button
      type="button"
      class="pin"
      [class.compact]="mode() === 'dot'"
      [class.no-name]="mode() !== 'full'"
      [class.selected]="pin().selected"
      [class.hovered]="hovered()"
      [style.--rating-color]="pin().color"
      [attr.aria-label]="label()"
      [attr.aria-current]="pin().selected ? 'true' : null"
      (click)="pinSelect.emit(pin().id)"
      (focus)="onFocus($event)"
      (mouseenter)="pinHover.emit(true)"
      (mouseleave)="pinHover.emit(false)"
    >
      <i class="dot"></i>
      <span class="tag" aria-hidden="true">
        <b class="surf">{{ surf() }}</b>
        <span class="name">{{ pin().name }}</span>
      </span>
    </button>
  `,
  styleUrl: './spot-pin.component.scss',
})
export class SpotPinComponent {
  readonly pin = input.required<SpotPin>();
  readonly mode = input<LabelMode>('full');
  readonly heightUnit = input<HeightUnit>('ft');
  /** Highlighted from elsewhere, such as the spot's row in the ranking. */
  readonly hovered = input(false);

  /** The pin was clicked, or activated from the keyboard. Emits the spot id. */
  readonly pinSelect = output<string>();
  /** The pin received keyboard focus, so the map can bring it into view. */
  readonly pinFocus = output<void>();
  /** The pointer moved onto (`true`) or off (`false`) the pin. */
  readonly pinHover = output<boolean>();

  protected readonly surf = computed(() => surfText(this.pin().surf, this.heightUnit()));
  protected readonly label = computed(() => {
    const pin = this.pin();
    return `${pin.name}, ${rateScore(pin.score).label}, surf ${this.surf()}`;
  });

  protected onFocus(event: FocusEvent): void {
    // A mouse click focuses the button too; only keyboard focus should move the map.
    if ((event.target as HTMLElement).matches(':focus-visible')) this.pinFocus.emit();
  }
}
