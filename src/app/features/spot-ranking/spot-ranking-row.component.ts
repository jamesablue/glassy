import { Component, computed, ElementRef, input, output, viewChild } from '@angular/core';
import type { UnitSettings } from '../../domain/models';
import { SPEED_LABELS } from '../../domain/units';
import { SpeedPipe, SurfRangePipe } from '../../shared/pipes';
import { DirectionArrowComponent, ScorePillComponent } from '../../shared/ui';
import type { RankedSpot } from '../../state';

/**
 * One spot in the ranking: its rank and name, the surf, the wind and how it meets the shore, and
 * the score. The whole row is a button that selects the spot. Hovering or focusing it reports
 * `hoverChange`, so the map can highlight the spot's pin, and `hovered` lights the row up when the
 * pin is hovered instead.
 */
@Component({
  selector: 'glassy-spot-ranking-row',
  imports: [DirectionArrowComponent, ScorePillComponent, SpeedPipe, SurfRangePipe],
  template: `
    @let conditions = entry().conditions;
    <button
      #button
      type="button"
      class="row"
      [class.hovered]="hovered()"
      (click)="spotSelect.emit(entry().spot.id)"
      (mouseenter)="hoverChange.emit(true)"
      (mouseleave)="hoverChange.emit(false)"
      (focus)="hoverChange.emit(true)"
      (blur)="hoverChange.emit(false)"
    >
      <span class="rank" aria-hidden="true">{{ entry().rank }}</span>
      <span class="main">
        <span class="name">{{ entry().spot.name }}</span>
        <span class="sub">
          {{ conditions.surf | surfRange: units().height }} ·
          <glassy-direction-arrow [from]="conditions.sample.windDirection" />
          {{ conditions.sample.windSpeed | speed: units().speed }} {{ speedLabel() }}
          {{ conditions.windKind }}
        </span>
      </span>
      <glassy-score-pill [score]="conditions.score" />
    </button>
  `,
  styleUrl: './spot-ranking-row.component.scss',
})
export class SpotRankingRowComponent {
  readonly entry = input.required<RankedSpot>();
  readonly units = input.required<UnitSettings>();
  /** Highlighted from elsewhere, such as the spot's pin on the map. */
  readonly hovered = input(false);

  /** The row was clicked or activated from the keyboard. Emits the spot id. */
  readonly spotSelect = output<string>();
  /** The pointer or keyboard focus moved onto (`true`) or off (`false`) the row. */
  readonly hoverChange = output<boolean>();

  private readonly button = viewChild.required<ElementRef<HTMLButtonElement>>('button');
  protected readonly speedLabel = computed(() => SPEED_LABELS[this.units().speed]);

  /** Moves keyboard focus to the row, for example when the user comes back from the spot. */
  focus(): void {
    this.button().nativeElement.focus();
  }
}
