import { Component, computed, effect, input, output } from '@angular/core';

/**
 * A short message above the timeline, with an optional action such as "Retry". Urgent messages are
 * alerts that screen readers announce at once; the rest are polite status messages. With
 * `autoHideMs` it asks to be dismissed after that long; otherwise it stays until its action is used.
 */
@Component({
  selector: 'glassy-notification-toast',
  template: `
    {{ message() }}
    @if (actionLabel(); as label) {
      <button type="button" (click)="action.emit()">{{ label }}</button>
    }
  `,
  host: { '[attr.role]': 'role()' },
  styles: `
    :host {
      position: fixed;
      bottom: calc(var(--timeline-height) + 16px);
      left: 50%;
      z-index: 1200;
      max-width: min(520px, calc(100% - 32px));
      padding: 9px 14px;
      border: 1px solid rgba(239, 68, 68, 0.5);
      border-radius: 9px;
      background: var(--toast-bg);
      color: var(--danger-text);
      font-size: 12.5px;
      transform: translateX(-50%);
    }

    button {
      margin-left: 8px;
      font-weight: 700;
      text-decoration: underline;

      &:focus-visible {
        outline: 2px solid var(--accent-2);
        outline-offset: 2px;
      }
    }
  `,
})
export class NotificationToastComponent {
  readonly message = input.required<string>();
  /** The action button's label, or `null` for none. */
  readonly actionLabel = input<string | null>(null);
  /** Announce at once (`alert`) rather than politely (`status`). */
  readonly urgent = input(false);
  /** Ask to be dismissed after this long, ms, or never (`null`). */
  readonly autoHideMs = input<number | null>(null);

  /** The action button was used. */
  readonly action = output<void>();
  /** The message has been up for `autoHideMs`. */
  readonly dismiss = output<void>();

  protected readonly role = computed(() => (this.urgent() ? 'alert' : 'status'));

  constructor() {
    effect((onCleanup) => {
      const delay = this.autoHideMs();
      this.message(); // A new message starts the clock again.
      if (delay === null) return;
      const timer = setTimeout(() => this.dismiss.emit(), delay);
      onCleanup(() => clearTimeout(timer));
    });
  }
}
