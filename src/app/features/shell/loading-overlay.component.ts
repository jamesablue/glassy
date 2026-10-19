import { Component, input } from '@angular/core';

/** A spinner and a message in the middle of the screen while the first forecast loads. */
@Component({
  selector: 'glassy-loading-overlay',
  template: `<span class="spinner" aria-hidden="true"></span>{{ message() }}`,
  host: { role: 'status' },
  styles: `
    :host {
      position: fixed;
      top: 50%;
      left: 50%;
      z-index: 1200;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 18px;
      border-radius: 22px;
      background: var(--panel-solid);
      box-shadow: 0 6px 24px rgba(0, 0, 0, 0.5);
      font-weight: 600;
      transform: translate(-50%, -50%);
    }

    .spinner {
      width: 18px;
      height: 18px;
      border: 2.5px solid rgba(255, 255, 255, 0.2);
      border-top-color: var(--accent-2);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .spinner {
        animation-duration: 2.4s;
      }
    }
  `,
})
export class LoadingOverlayComponent {
  readonly message = input('Loading forecast…');
}
