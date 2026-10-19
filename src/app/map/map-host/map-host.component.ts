import {
  afterNextRender,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  output,
  viewChild,
} from '@angular/core';
import type * as L from 'leaflet';
import type { LatLon } from '../../domain/models';
import { createMap } from './create-map';
import { frameOahu } from './frame-oahu';
import { MapContext } from './map-context';

/**
 * The Leaflet map. It creates the map, its panes and controls once it is rendered, frames Oahu, and
 * shares the map with the layer components projected into it through {@link MapContext}:
 *
 * ```html
 * <glassy-map (mapClick)="inspect($event)">
 *   <glassy-basemap-layer />
 *   <glassy-depth-layer [visible]="isDepth()" />
 * </glassy-map>
 * ```
 *
 * Destroying it removes the map, and with it every layer, listener and DOM node Leaflet added.
 */
@Component({
  selector: 'glassy-map',
  template: '<div #container class="map"></div><ng-content />',
  styleUrl: './map-host.component.scss',
  providers: [MapContext],
})
export class MapHostComponent {
  /** A click or tap on the map itself, not on a spot pin or a popup. */
  readonly mapClick = output<LatLon>();

  private readonly container = viewChild.required<ElementRef<HTMLElement>>('container');
  private readonly context = inject(MapContext);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    afterNextRender(() => {
      const map = createMap(this.container().nativeElement);
      frameOahu(map);
      map.on('click', (event: L.LeafletMouseEvent) =>
        this.mapClick.emit({ lat: event.latlng.lat, lon: event.latlng.lng }),
      );
      const disconnect = this.context.connect(map);
      this.destroyRef.onDestroy(() => {
        disconnect();
        map.remove();
      });
    });
  }
}
