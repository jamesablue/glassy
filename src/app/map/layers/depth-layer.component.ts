import { Component, inject, input } from '@angular/core';
import { TERRAIN_TILE_SOURCES } from '../../core/terrain-tile-sources';
import { keepLayerOnMap } from './keep-layer-on-map';
import { NoaaExportTileLayer } from './noaa-export-tile-layer';

/**
 * NOAA tiles colouring the water by depth class, in the `depth` pane. Tiles are only requested
 * while the layer is visible.
 */
@Component({ selector: 'glassy-depth-layer', template: '' })
export class DepthLayerComponent {
  readonly visible = input(false);

  constructor() {
    const sources = inject(TERRAIN_TILE_SOURCES);
    keepLayerOnMap(
      new NoaaExportTileLayer((tile, ratio) => sources.depthTileUrl(tile, ratio), {
        pane: 'depth',
      }),
      () => this.visible(),
    );
  }
}
