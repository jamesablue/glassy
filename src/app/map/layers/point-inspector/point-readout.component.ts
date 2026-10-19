import { Component, computed, input } from '@angular/core';
import type { UnitSettings } from '../../../domain/models';
import type { PointReading } from '../../../state';
import { readoutRows, readoutTitle } from './readout-rows';

/**
 * The forecast and depth at a tapped map point, shown in the point inspector's popup. It announces
 * changes politely, so screen readers hear the depth when NOAA answers.
 */
@Component({
  selector: 'glassy-point-readout',
  template: `
    @if (reading()) {
      <p class="title">{{ title() }}</p>
      <dl class="rows" aria-live="polite">
        @for (row of rows(); track row.label) {
          <div class="row" [class.depth]="row.label === 'Depth'">
            <dt>{{ row.label }}</dt>
            <dd>
              @if (row.heading !== undefined) {
                <svg
                  class="arrow"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  [style.transform]="'rotate(' + row.heading + 'deg)'"
                >
                  <path d="M12 2l6.5 9H14v11h-4V11H5.5z" fill="currentColor" />
                </svg>
              }
              {{ row.value }}
            </dd>
          </div>
        }
      </dl>
    }
  `,
  styleUrl: './point-readout.component.scss',
})
export class PointReadoutComponent {
  readonly reading = input<PointReading | null>(null);
  readonly units = input.required<UnitSettings>();

  protected readonly title = computed(() => {
    const reading = this.reading();
    return reading ? readoutTitle(reading) : '';
  });
  protected readonly rows = computed(() => {
    const reading = this.reading();
    return reading ? readoutRows(reading, this.units()) : [];
  });
}
