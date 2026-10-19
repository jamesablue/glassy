import { Component } from '@angular/core';
import { GuardedTileLayer, injectTileOutage } from './guarded-tile-layer';
import { keepLayerOnMap } from './keep-layer-on-map';

const ESRI_CANVAS = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas';
export const ESRI_BASE_URL = `${ESRI_CANVAS}/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}`;
export const ESRI_LABELS_URL = `${ESRI_CANVAS}/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}`;
const ESRI_ATTRIBUTION =
  'Basemap © <a href="https://www.esri.com/">Esri</a>, HERE, Garmin, © ' +
  '<a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

/**
 * Esri's dark grey basemap under everything, and its place names in the `labels` pane above the
 * forecast colours so they stay readable. If Esri stops answering, the map carries on without them
 * and the app says so once (see `TileOutage`).
 */
@Component({ selector: 'glassy-basemap-layer', template: '' })
export class BasemapLayerComponent {
  constructor() {
    keepLayerOnMap(
      new GuardedTileLayer(
        ESRI_BASE_URL,
        { maxZoom: 16, attribution: ESRI_ATTRIBUTION },
        injectTileOutage(),
      ),
    );
    keepLayerOnMap(
      new GuardedTileLayer(ESRI_LABELS_URL, { maxZoom: 16, pane: 'labels' }, injectTileOutage()),
    );
  }
}
