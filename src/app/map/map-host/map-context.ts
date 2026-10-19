import { Injectable, signal } from '@angular/core';
import type * as L from 'leaflet';
import type { MapView } from '../renderers/map-view';

/** The map view's size and zoom, replaced after every move, zoom or resize. */
export interface MapViewport {
  readonly zoom: number;
  /** CSS pixels. */
  readonly width: number;
  readonly height: number;
}

/**
 * The Leaflet map shared by `MapHostComponent` with the layer components projected into it.
 *
 * Besides the map itself it turns the map's movement into a few signals, so each layer can react in
 * an `effect()` instead of subscribing to Leaflet events and cleaning them up on its own.
 */
@Injectable()
export class MapContext {
  private readonly mapState = signal<L.Map | undefined>(undefined);
  private readonly viewportState = signal<MapViewport | undefined>(undefined);
  private readonly movingState = signal(false);
  private readonly zoomingState = signal(false);

  /** The map, once the host has created it. */
  readonly map = this.mapState.asReadonly();
  /** A new value after every move, zoom and resize: layers drawn for the view redraw on it. */
  readonly viewport = this.viewportState.asReadonly();
  /** From the start of a pan or zoom until it ends. */
  readonly moving = this.movingState.asReadonly();
  /** From the start of a zoom until the map settles. */
  readonly zooming = this.zoomingState.asReadonly();

  /** Shares `map` with the layers. Returns a function that stops sharing it. */
  connect(map: L.Map): () => void {
    const measure = (): void =>
      this.viewportState.set({
        zoom: map.getZoom(),
        width: map.getSize().x,
        height: map.getSize().y,
      });
    const events: L.LeafletEventHandlerFnMap = {
      movestart: () => this.movingState.set(true),
      zoomstart: () => {
        this.movingState.set(true);
        this.zoomingState.set(true);
      },
      moveend: () => {
        this.movingState.set(false);
        this.zoomingState.set(false);
        measure();
      },
      resize: measure,
    };
    map.on(events);
    measure();
    this.mapState.set(map);

    return () => {
      map.off(events);
      this.mapState.set(undefined);
      this.viewportState.set(undefined);
    };
  }
}

/** The current view in the plain form the renderers take. */
export function mapView(map: L.Map): MapView {
  const size = map.getSize();
  const origin = map.containerPointToLayerPoint([0, 0]);
  return {
    width: size.x,
    height: size.y,
    origin: { x: origin.x, y: origin.y },
    toLatLon: (x, y) => {
      const { lat, lng } = map.containerPointToLatLng([x, y]);
      return { lat, lon: lng };
    },
  };
}
