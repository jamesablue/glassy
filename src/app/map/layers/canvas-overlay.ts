import * as L from 'leaflet';
import type { MapPaneName } from '../map-host/map-panes';

/**
 * A canvas placed in a map pane, wrapped as a Leaflet layer so it is added and removed like any
 * other layer (and removed with the map). Drawing on it is left to a renderer.
 */
export class CanvasOverlay extends L.Layer {
  constructor(
    readonly canvas: HTMLCanvasElement,
    pane: MapPaneName,
  ) {
    super();
    L.setOptions(this, { pane });
  }

  override onAdd(): this {
    this.getPane()?.appendChild(this.canvas);
    return this;
  }

  override onRemove(): this {
    this.canvas.remove();
    return this;
  }
}
