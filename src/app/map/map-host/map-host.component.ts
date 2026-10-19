import {
  afterNextRender,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  output,
  untracked,
  viewChild,
} from '@angular/core';
import type * as L from 'leaflet';
import { PREFERS_REDUCED_MOTION } from '../../core/reduced-motion';
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
 *
 * The map is the page's `main` landmark. Leaflet makes it focusable: focused, the arrow keys pan
 * it and + and − zoom, Enter inspects the point in the middle (the keyboard's way to tap the sea),
 * and Tab moves on through the spot pins and the zoom buttons. The arrows are marked as handled
 * there, so the app-wide shortcuts (which step the timeline) leave them alone.
 */
@Component({
  selector: 'glassy-map',
  template: `
    <div #container class="map" role="main" aria-label="Forecast map" aria-describedby="map-keys">
      <p id="map-keys" class="visually-hidden">
        Arrow keys pan the map and plus and minus zoom. Enter shows the forecast and depth at the
        middle of the map.
      </p>
    </div>
    <ng-content />
  `,
  styleUrl: './map-host.component.scss',
  providers: [MapContext],
})
export class MapHostComponent {
  /** A click or tap on the map itself, not on a spot pin or a popup. */
  readonly mapClick = output<LatLon>();

  private readonly container = viewChild.required<ElementRef<HTMLElement>>('container');
  private readonly context = inject(MapContext);
  private readonly destroyRef = inject(DestroyRef);
  private readonly reducedMotion = inject(PREFERS_REDUCED_MOTION);

  constructor() {
    afterNextRender(() => {
      const container = this.container().nativeElement;
      const map = createMap(container, untracked(this.reducedMotion));
      frameOahu(map);
      const inspect = ({ lat, lng }: L.LatLng): void => this.mapClick.emit({ lat, lon: lng });
      map.on('click', (event: L.LeafletMouseEvent) => inspect(event.latlng));
      const onKeydown = (event: KeyboardEvent): void => {
        // Only keys pressed on the map itself; the pins and controls inside it handle their own.
        if (event.target !== container) return;
        if (PAN_KEYS.has(event.key)) event.preventDefault();
        if (event.key === 'Enter') inspect(map.getCenter());
      };
      container.addEventListener('keydown', onKeydown);
      const disconnect = this.context.connect(map);
      this.destroyRef.onDestroy(() => {
        disconnect();
        container.removeEventListener('keydown', onKeydown);
        map.remove();
      });
    });
  }
}

/**
 * The keys Leaflet pans with while the map has focus. They are marked as handled on the map, because
 * Leaflet listens on the document, after the app's shortcuts, and does not say so itself.
 */
const PAN_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']);
