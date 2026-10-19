import { DestroyRef, effect, inject } from '@angular/core';
import type * as L from 'leaflet';
import { MapContext } from '../map-host/map-context';

/**
 * Keeps a Leaflet layer on the host's map while `shown()` is true and takes it off when the calling
 * component is destroyed. Call it from a layer component's constructor: it waits for the map, follows
 * any signals `shown` reads, and cleans up without the component tracking anything itself.
 */
export function keepLayerOnMap(layer: L.Layer, shown: () => boolean = () => true): void {
  const context = inject(MapContext);
  effect(() => {
    const map = context.map();
    if (map && shown()) layer.addTo(map);
    else layer.remove();
  });
  inject(DestroyRef).onDestroy(() => layer.remove());
}
