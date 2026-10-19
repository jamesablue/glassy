import { Component, computed, input } from '@angular/core';
import { ICONS, type IconName } from './icons';

/**
 * A line icon from the inline set in `icons.ts`. It is decorative: the control it sits in carries
 * the accessible name. It fills its host, which is 1em square unless the parent sizes it, and
 * draws in `currentColor`.
 *
 * ```html
 * <glassy-icon name="wind" />
 * ```
 */
@Component({
  selector: 'glassy-icon',
  template: `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      @for (shape of shapes(); track $index) {
        <path
          [attr.d]="shape.d"
          [attr.fill]="shape.fill"
          [attr.stroke]="shape.stroke"
          [attr.stroke-width]="shape.strokeWidth"
        />
      }
    </svg>
  `,
  styles: `
    :host {
      display: inline-block;
      flex: none;
      width: 1em;
      height: 1em;
    }

    svg {
      display: block;
      width: 100%;
      height: 100%;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
  `,
})
export class IconComponent {
  readonly name = input.required<IconName>();

  protected readonly shapes = computed(() => ICONS[this.name()]);
}
