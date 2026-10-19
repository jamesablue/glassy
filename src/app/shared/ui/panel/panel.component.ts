import { Component } from '@angular/core';

/**
 * The dark, translucent card the floating UI is built from: the map shows through, blurred, behind
 * the panel's content.
 *
 * ```html
 * <glassy-panel class="side">…</glassy-panel>
 * ```
 */
@Component({
  selector: 'glassy-panel',
  template: '<ng-content />',
  styles: `
    :host {
      display: block;
      border-radius: var(--radius);
      background: var(--panel);
      box-shadow: var(--shadow-panel);
      backdrop-filter: blur(12px);
    }
  `,
})
export class PanelComponent {}
