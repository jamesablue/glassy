import { Component, input, output } from '@angular/core';
import { IconComponent } from '../../shared/ui';

/** Switches for what is drawn over the active layer: the moving particles and the spot pins. */
@Component({
  selector: 'glassy-map-toggles',
  imports: [IconComponent],
  template: `
    <button
      type="button"
      [class.on]="particlesOn()"
      [attr.aria-pressed]="particlesOn()"
      (click)="particlesToggle.emit()"
    >
      <span class="icon"><glassy-icon name="particles" /></span>
      <span class="label">Particles</span>
    </button>
    <button
      type="button"
      [class.on]="spotsOn()"
      [attr.aria-pressed]="spotsOn()"
      (click)="spotsToggle.emit()"
    >
      <span class="icon"><glassy-icon name="spots" /></span>
      <span class="label">Spots</span>
    </button>
  `,
  styleUrl: './map-toggles.component.scss',
  host: { role: 'group', 'aria-label': 'Map overlays' },
})
export class MapTogglesComponent {
  readonly particlesOn = input.required<boolean>();
  readonly spotsOn = input.required<boolean>();

  readonly particlesToggle = output<void>();
  readonly spotsToggle = output<void>();
}
