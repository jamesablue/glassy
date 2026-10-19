import { Component, input, signal } from '@angular/core';

let nextTitleId = 0;

/**
 * A non-modal popover card on the native Popover API. The browser puts it in the top layer, closes
 * it on Escape or a click outside, keeps one open at a time, and moves Tab from the button that
 * opened it into it. Open it declaratively with a button that names its id:
 *
 * ```html
 * <button type="button" popovertarget="units-popover">Units</button>
 * <glassy-popover id="units-popover" heading="Units">…</glassy-popover>
 * ```
 *
 * `isOpen` follows the browser, for content that should only render once the popover has been
 * opened and for key handlers that should leave Escape to an open popover. It listens to
 * `beforetoggle`, which fires as the popover opens or closes, rather than `toggle`, which arrives a
 * task later: a key pressed in between would otherwise see the old state.
 *
 * Place it with `--popover-top`, `--popover-right` and `--popover-width`.
 */
@Component({
  selector: 'glassy-popover',
  template: `
    <h2 class="title" [id]="titleId">{{ heading() }}</h2>
    <ng-content />
  `,
  host: {
    popover: 'auto',
    role: 'dialog',
    '[attr.aria-labelledby]': 'titleId',
    '(beforetoggle)': 'onToggle($event)',
  },
  styles: `
    // No display here: the browser hides a closed popover with display: none.
    :host {
      position: fixed;
      inset: var(--popover-top, 64px) var(--popover-right, 64px) auto auto;
      width: var(--popover-width, 300px);
      margin: 0;
      padding: 12px 14px;
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: var(--panel-solid);
      color: var(--text);
      box-shadow: var(--shadow-popover);
    }

    .title {
      margin: 0 0 8px;
      font-size: 14px;
      font-weight: 700;
    }

    @media (max-width: 760px) {
      :host {
        inset: 60px 52px auto 8px;
        width: auto;
      }
    }
  `,
})
export class PopoverComponent {
  readonly heading = input.required<string>();

  private readonly open = signal(false);
  /** Whether the browser is showing the popover. */
  readonly isOpen = this.open.asReadonly();

  protected readonly titleId = `glassy-popover-title-${nextTitleId++}`;

  protected onToggle(event: Event): void {
    this.open.set((event as ToggleEvent).newState === 'open');
  }
}
