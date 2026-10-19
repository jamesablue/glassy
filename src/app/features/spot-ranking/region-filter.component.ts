import { Component, input, output } from '@angular/core';
import { ChipGroupComponent, type ChoiceOption } from '../../shared/ui';
import type { RegionFilter } from '../../state';

/** The ranking's filters, in the order the coast runs clockwise from the North Shore. */
export const REGION_OPTIONS: readonly ChoiceOption<RegionFilter>[] = [
  { value: 'all', label: 'All' },
  { value: 'North Shore', label: 'North' },
  { value: 'Windward', label: 'Windward' },
  { value: 'South Shore', label: 'South' },
  { value: 'West Side', label: 'West' },
];

/** Narrows the ranking to one stretch of coast, or shows them all. */
@Component({
  selector: 'glassy-region-filter',
  imports: [ChipGroupComponent],
  template: `
    <glassy-chip-group
      label="Region"
      [options]="options"
      [value]="value()"
      (valueChange)="valueChange.emit($event)"
    />
  `,
})
export class RegionFilterComponent {
  readonly value = input.required<RegionFilter>();
  readonly valueChange = output<RegionFilter>();

  protected readonly options = REGION_OPTIONS;
}
