import { Component } from '@angular/core';

/**
 * A small "Loading map layers…" chip at the top of the map while the spot forecast is on show and
 * the map grid (the colours and particles) is still on its way. It is a polite status, so screen
 * readers hear it once, and it ignores the pointer, so the map under it can still be tapped.
 */
@Component({
  selector: 'glassy-map-layers-chip',
  template: `<span class="spinner" aria-hidden="true"></span>Loading map layers…`,
  host: { role: 'status' },
  styles: `
    :host {
      position: fixed;
      top: 16px;
      left: 50%;
      z-index: 1000;
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 12px;
      border-radius: 16px;
      background: var(--panel-solid);
      box-shadow: var(--shadow-raised);
      font-size: 12px;
      font-weight: 600;
      pointer-events: none;
      transform: translateX(-50%);
    }

    .spinner {
      width: 12px;
      height: 12px;
      border: 2px solid rgba(255, 255, 255, 0.2);
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

    // On a phone the top centre belongs to the brand, so the chip sits just below it.
    @media (max-width: 760px) {
      :host {
        top: 54px;
        left: 8px;
        transform: none;
      }
    }
  `,
})
export class MapLayersChipComponent {}
