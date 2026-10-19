import { Component } from '@angular/core';
import { ChoiceGroup } from '../choice-group/choice-group';

/**
 * A row of joined options with one selected, for settings such as a unit:
 *
 * ```html
 * <span id="speed-label">Wind</span>
 * <glassy-segmented-control labelledBy="speed-label" [options]="speeds" [value]="speed()"
 *   (valueChange)="setSpeed($event)" />
 * ```
 *
 * An accessible radio group; see {@link ChoiceGroup} for the keyboard behaviour.
 */
@Component({
  selector: 'glassy-segmented-control',
  template: `
    @for (choice of choices(); track choice.value) {
      <button
        type="button"
        role="radio"
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
      flex: none;
      padding: 2px;
      border-radius: 7px;
      background: rgba(255, 255, 255, 0.07);
    }

    button {
      padding: 4px 9px;
      border-radius: 5px;
      color: var(--muted);
      font-size: 12px;
      font-weight: 600;

      &:hover {
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
export class SegmentedControlComponent<T extends string> extends ChoiceGroup<T> {}
