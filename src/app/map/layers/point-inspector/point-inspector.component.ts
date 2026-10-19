import {
  afterRenderEffect,
  ApplicationRef,
  Component,
  createComponent,
  DestroyRef,
  effect,
  EnvironmentInjector,
  inject,
  inputBinding,
} from '@angular/core';
import * as L from 'leaflet';
import { MapUiStore, PointInspectionStore, SettingsStore } from '../../../state';
import { MapContext } from '../../map-host/map-context';
import { PointReadoutComponent } from './point-readout.component';

/**
 * A popup at the inspected map point (`MapUiStore.inspectedPoint`) with a
 * {@link PointReadoutComponent} inside. The readout reads `PointInspectionStore`, so it follows the
 * hour and units as they change, and closing the popup clears the inspection.
 */
@Component({ selector: 'glassy-point-inspector', template: '' })
export class PointInspectorComponent {
  constructor() {
    const context = inject(MapContext);
    const mapUi = inject(MapUiStore);
    const inspection = inject(PointInspectionStore);
    const settings = inject(SettingsStore);
    const appRef = inject(ApplicationRef);

    const readout = createComponent(PointReadoutComponent, {
      environmentInjector: inject(EnvironmentInjector),
      bindings: [
        inputBinding('reading', inspection.reading),
        inputBinding('units', settings.units),
      ],
    });
    appRef.attachView(readout.hostView);

    const popup = L.popup({
      className: 'picker',
      closeButton: false,
      autoPan: false,
      offset: [0, -2],
      maxWidth: 280,
    }).setContent(readout.location.nativeElement as HTMLElement);
    // Leaflet closes the popup on a map click or Escape; the inspection ends with it.
    const endInspection = (): void => mapUi.clearInspection();
    popup.on('remove', endInspection);

    effect(() => {
      const map = context.map();
      const point = mapUi.inspectedPoint();
      if (map && point) popup.setLatLng([point.lat, point.lon]).openOn(map);
      else popup.close();
    });
    // Leaflet centres the popup on its content's width, so measure again after the readout changes.
    afterRenderEffect(() => {
      inspection.reading();
      settings.units();
      if (popup.isOpen()) popup.update();
    });

    inject(DestroyRef).onDestroy(() => {
      popup.off('remove', endInspection);
      popup.remove();
      readout.destroy();
    });
  }
}
