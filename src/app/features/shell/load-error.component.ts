import { afterNextRender, Component, ElementRef, input, output, viewChild } from '@angular/core';

/**
 * The screen shown when the first forecast could not be loaded and there is nothing cached to fall
 * back on: what went wrong and a Retry button, over the empty map.
 *
 * It is a modal `<dialog>`, so the browser keeps focus inside it, starts it on Retry, and makes the
 * controls behind it (which have nothing to work on yet) unreachable. Escape closes it like any
 * other dialog, leaving the error as a toast with its own Retry.
 */
@Component({
  selector: 'glassy-load-error',
  template: `
    <dialog
      #dialog
      role="alertdialog"
      aria-labelledby="load-error-title"
      aria-describedby="load-error-detail"
      (cancel)="dismiss.emit()"
    >
      <h2 id="load-error-title">{{ title() }}</h2>
      <p id="load-error-detail">{{ detail() }}</p>
      <button type="button" autofocus (click)="retry.emit()">Retry</button>
    </dialog>
  `,
  styles: `
    dialog {
      max-width: min(360px, calc(100% - 32px));
      padding: 20px 22px;
      border: 1px solid var(--danger-line);
      border-radius: var(--radius);
      background: var(--panel-solid);
      color: var(--text);
      box-shadow: var(--shadow-popover);
      text-align: center;

      &::backdrop {
        background: rgba(5, 6, 8, 0.72);
      }
    }

    h2 {
      margin: 0 0 6px;
      font-size: 16px;
      font-weight: 700;
    }

    p {
      margin: 0 0 16px;
      color: var(--muted);
    }

    button {
      padding: 8px 20px;
      border-radius: 18px;
      background: var(--text);
      color: var(--on-light);
      font-weight: 700;

      &:hover {
        background: #fff;
      }

      &:focus-visible {
        outline: 2px solid var(--accent-2);
        outline-offset: 2px;
      }
    }
  `,
})
export class LoadErrorComponent {
  readonly title = input.required<string>();
  readonly detail = input.required<string>();

  /** The Retry button was used. */
  readonly retry = output<void>();
  /** The user closed the screen with Escape. */
  readonly dismiss = output<void>();

  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  constructor() {
    afterNextRender(() => this.dialog().nativeElement.showModal());
  }
}
