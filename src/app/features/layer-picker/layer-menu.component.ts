import { Component, inject } from '@angular/core';
import type { LayerId } from '../../domain/models';
import { IconComponent } from '../../shared/ui';
import { MapUiStore } from '../../state';
import { ABOUT_POPOVER_ID } from '../about/about-popover.component';
import { UNITS_POPOVER_ID } from '../settings/units-popover.component';
import { LayerPickerComponent } from './layer-picker.component';
import { MapTogglesComponent } from './map-toggles.component';

/**
 * The menu down the right edge of the map: the layers, the overlay switches, and the Units and
 * About buttons. Those two open their popovers natively (`popovertarget`), so the browser handles
 * toggling, light dismiss and `aria-expanded`.
 */
@Component({
  selector: 'glassy-layer-menu',
  imports: [IconComponent, LayerPickerComponent, MapTogglesComponent],
  template: `
    <nav aria-label="Map controls">
      <glassy-layer-picker [active]="mapUi.activeLayer()" (layerChange)="setLayer($event)" />
      <glassy-map-toggles
        class="toggles"
        [particlesOn]="mapUi.particlesOn()"
        [spotsOn]="mapUi.spotsOn()"
        (particlesToggle)="mapUi.toggleParticles()"
        (spotsToggle)="mapUi.toggleSpots()"
      />
      <button type="button" [attr.popovertarget]="unitsPopoverId">
        <span class="icon"><glassy-icon name="units" /></span>
        <span class="label">Units</span>
      </button>
      <button type="button" [attr.popovertarget]="aboutPopoverId">
        <span class="icon"><glassy-icon name="about" /></span>
        <span class="label">About</span>
      </button>
    </nav>
  `,
  styleUrl: './layer-menu.component.scss',
})
export class LayerMenuComponent {
  protected readonly mapUi = inject(MapUiStore);

  protected readonly unitsPopoverId = UNITS_POPOVER_ID;
  protected readonly aboutPopoverId = ABOUT_POPOVER_ID;

  protected setLayer(layer: LayerId): void {
    this.mapUi.setLayer(layer);
  }
}
