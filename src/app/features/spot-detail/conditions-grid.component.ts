import { Component, computed, input } from '@angular/core';
import type { Conditions, UnitSettings } from '../../domain/models';
import { DirectionArrowComponent } from '../../shared/ui';
import { conditionCells } from './condition-cells';

/**
 * The spot's readings at the selected hour as a two-column grid: surf, wind, the three wave
 * components, water temperature, current, sea level and rain chance (see `conditionCells`).
 */
@Component({
  selector: 'glassy-conditions-grid',
  imports: [DirectionArrowComponent],
  template: `
    <dl class="stats">
      @for (cell of cells(); track cell.label) {
        <div class="stat" [class.wide]="cell.wide">
          <dt>{{ cell.label }}</dt>
          <dd class="value">
            @if (cell.arrowFrom !== null) {
              <glassy-direction-arrow [from]="cell.arrowFrom" />
            }
            @for (part of cell.value; track $index) {
              {{ part.text }}<small>{{ part.unit }}</small>
            }
          </dd>
          @if (cell.detail) {
            <dd class="detail">
              @if (cell.detailArrowFrom !== null) {
                <glassy-direction-arrow [from]="cell.detailArrowFrom" />
              }
              {{ cell.detail }}
            </dd>
          }
        </div>
      }
    </dl>
  `,
  styleUrl: './conditions-grid.component.scss',
})
export class ConditionsGridComponent {
  readonly conditions = input.required<Conditions>();
  readonly units = input.required<UnitSettings>();

  protected readonly cells = computed(() => conditionCells(this.conditions(), this.units()));
}
