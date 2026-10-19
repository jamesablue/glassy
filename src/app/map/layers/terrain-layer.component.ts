import { Component, effect, inject, input } from '@angular/core';
import { TERRAIN_TILE_SOURCES } from '../../core/terrain-tile-sources';
import { MapContext } from '../map-host/map-context';
import { injectTileOutage } from './guarded-tile-layer';
import { keepLayerOnMap } from './keep-layer-on-map';
import { NoaaExportTileLayer } from './noaa-export-tile-layer';

/**
 * How the land is drawn: blended into the wind colours, which cover land and sea alike, or as dark
 * relief that frames the sea colours.
 */
export type TerrainMode = 'wind' | 'sea';

/** NOAA's shaded relief of the island in the `land` pane, styled for the active layer. */
@Component({ selector: 'glassy-terrain-layer', template: '' })
export class TerrainLayerComponent {
  readonly mode = input<TerrainMode>('sea');

  constructor() {
    const sources = inject(TERRAIN_TILE_SOURCES);
    const context = inject(MapContext);
    keepLayerOnMap(
      new NoaaExportTileLayer(
        (tile, ratio) => sources.landTileUrl(tile, ratio),
        { pane: 'land' },
        injectTileOutage(),
      ),
    );

    // The styling lives on the pane (see leaflet-overrides.scss), so it covers every tile at once.
    effect(() => {
      const pane = context.map()?.getPane('land');
      if (!pane) return;
      pane.classList.toggle('mode-wind', this.mode() === 'wind');
      pane.classList.toggle('mode-sea', this.mode() === 'sea');
    });
  }
}
