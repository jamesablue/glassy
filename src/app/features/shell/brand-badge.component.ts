import { Component } from '@angular/core';

/** The logo, name and tagline in the top-left corner. Phones show the name only. */
@Component({
  selector: 'glassy-brand-badge',
  template: `
    <header class="brand">
      <svg class="logo" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
        <circle cx="16" cy="16" r="15" fill="#0b1220" stroke="rgba(255,255,255,.25)" />
        <path
          d="M5 18c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2 2-1 2-1"
          fill="none"
          stroke="#5eead4"
          stroke-width="2.2"
          stroke-linecap="round"
        />
        <path
          d="M8 23c2 0 2-1.4 4-1.4S14 23 16 23s2-1.4 4-1.4 2 1.4 4 1.4"
          fill="none"
          stroke="#38bdf8"
          stroke-width="1.8"
          stroke-linecap="round"
          opacity=".8"
        />
        <circle cx="21" cy="10" r="3" fill="#fbbf24" />
      </svg>
      <div>
        <h1 class="name">Glassy</h1>
        <p class="tagline">Oahu snorkel forecast</p>
      </div>
    </header>
  `,
  styles: `
    // Floats over the map's top-left corner.
    .brand {
      position: fixed;
      top: 12px;
      left: 12px;
      z-index: 1000;
      display: flex;
      align-items: center;
      gap: 9px;
      padding: 6px 12px 6px 6px;
      border-radius: 22px;
      background: var(--panel);
      box-shadow: var(--shadow-raised);
      backdrop-filter: blur(10px);
    }

    .logo {
      flex: none;
      width: 32px;
      height: 32px;
    }

    .name {
      margin: 0;
      font-size: 15px;
      font-weight: 700;
      letter-spacing: 0.2px;
    }

    .tagline {
      margin: -2px 0 0;
      color: var(--muted);
      font-size: 11px;
    }

    @media (max-width: 760px) {
      .brand {
        top: 8px;
        left: 8px;
      }

      .tagline {
        display: none;
      }
    }
  `,
})
export class BrandBadgeComponent {}
