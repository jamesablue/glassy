import { Component, input } from '@angular/core';

/**
 * The card the floating UI is built from. `glass` (the default) is the dark, translucent, blurred
 * surface the map shows through; `solid` is opaque with a hairline border, for popovers and notices
 * that must stay readable over anything.
 *
 * ```html
 * <glassy-panel class="side">…</glassy-panel>
 * ```
 */
@Component({
  selector: 'glassy-panel',
  template: '<ng-content />',
  host: { '[class.solid]': "variant() === 'solid'" },
  styles: `
    :host {
      display: block;
      border-radius: var(--radius);
      background: var(--panel);
      box-shadow: var(--shadow-panel);
      backdrop-filter: blur(12px);
    }

    :host(.solid) {
      border: 1px solid var(--line);
      background: var(--panel-solid);
      box-shadow: var(--shadow-popover);
      backdrop-filter: none;
    }
  `,
})
export class PanelComponent {
  readonly variant = input<'glass' | 'solid'>('glass');
}
