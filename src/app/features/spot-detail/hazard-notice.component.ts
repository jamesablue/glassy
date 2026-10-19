import { Component, computed, input } from '@angular/core';
import type { Conditions, HeightUnit } from '../../domain/models';
import type { Hazard } from '../../domain/scoring';
import { hazardMessage } from './hazard-messages';

/**
 * The safety warnings for the conditions shown: big surf, strong onshore wind, strong current.
 * Nothing renders when there are none.
 */
@Component({
  selector: 'glassy-hazard-notice',
  template: `
    @if (messages().length) {
      <div class="warn" role="note" aria-label="Warnings">
        @for (message of messages(); track message) {
          <p>{{ message }}</p>
        }
      </div>
    }
  `,
  styles: `
    :host {
      display: block;
    }

    .warn {
      margin-bottom: 10px;
      padding: 7px 9px;
      border: 1px solid var(--danger-line);
      border-radius: 8px;
      background: var(--danger-bg);
      color: var(--danger-text);
      font-size: 12px;
    }

    p {
      display: inline;
      margin: 0;

      & + p::before {
        content: ' ';
      }
    }
  `,
})
export class HazardNoticeComponent {
  /** The warnings that apply, from `hazardsFor`. */
  readonly hazards = input.required<readonly Hazard[]>();
  readonly conditions = input.required<Conditions>();
  readonly heightUnit = input.required<HeightUnit>();

  protected readonly messages = computed(() =>
    this.hazards().map((hazard) => hazardMessage(hazard, this.conditions(), this.heightUnit())),
  );
}
