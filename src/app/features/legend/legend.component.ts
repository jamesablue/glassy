import { Component, computed, input } from '@angular/core';
import { cssRgb } from '../../domain/color';
import type { LegendSpec } from '../../domain/legend';

/**
 * The colour key for the active layer: its unit, then one cell per tick. Forecast layers blend each
 * cell into the next; the depth layer shows solid bands. Each label is black or white, whichever
 * has more contrast on its cell (`LegendSpec` works that out). It is a labelled region of its own,
 * so screen reader users can find the key to the map's colours.
 */
@Component({
  selector: 'glassy-legend',
  template: `
    <span class="unit">{{ spec().unit }}</span>
    <ol class="bar" [class.classes]="isClasses()">
      @for (cell of cells(); track $index) {
        <li [class.dark]="cell.dark" [style.background]="cell.background">{{ cell.label }}</li>
      }
    </ol>
  `,
  host: { role: 'region', '[attr.aria-label]': 'label()' },
  styleUrl: './legend.component.scss',
})
export class LegendComponent {
  readonly spec = input.required<LegendSpec>();

  protected readonly label = computed(() => `Map colours, ${this.spec().unit}`);
  protected readonly isClasses = computed(() => this.spec().kind === 'classes');
  protected readonly cells = computed(() =>
    this.spec().cells.map((cell) => ({
      label: cell.label,
      dark: cell.ink === 'dark',
      background: this.isClasses()
        ? cssRgb(cell.from)
        : `linear-gradient(to right, ${cssRgb(cell.from)}, ${cssRgb(cell.to)})`,
    })),
  );
}
