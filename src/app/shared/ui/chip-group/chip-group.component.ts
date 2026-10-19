import { Component } from '@angular/core';
import { ChoiceGroup } from '../choice-group/choice-group';

/**
 * A wrapping row of pill-shaped options with one selected, for filters:
 *
 * ```html
 * <glassy-chip-group label="Region" [options]="regions" [value]="region()"
 *   (valueChange)="setRegion($event)" />
 * ```
 *
 * An accessible radio group; see {@link ChoiceGroup} for the keyboard behaviour.
 */
@Component({
  selector: 'glassy-chip-group',
  template: `
    @for (choice of choices(); track choice.value) {
      <button
        type="button"
        role="radio"
        class="chip"
        [attr.aria-checked]="choice.checked"
        [tabIndex]="choice.tabIndex"
        (click)="choose(choice.value)"
      >
        {{ choice.label }}
      </button>
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .chip {
      padding: 4px 10px;
      border-radius: 14px;
      background: rgba(255, 255, 255, 0.07);
      color: var(--muted);
      font-size: 12px;
      font-weight: 600;

      &:hover {
        background: rgba(255, 255, 255, 0.12);
        color: var(--text);
      }

      &[aria-checked='true'] {
        background: var(--text);
        color: var(--on-light);
      }

      &:focus-visible {
        outline: 2px solid var(--accent-2);
        outline-offset: 1px;
      }
    }
  `,
})
export class ChipGroupComponent<T extends string> extends ChoiceGroup<T> {}
