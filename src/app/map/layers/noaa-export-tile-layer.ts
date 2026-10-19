import type * as L from 'leaflet';
import type { TileCoords } from '../../core/terrain-tile-sources';
import { GuardedTileLayer } from './guarded-tile-layer';
import type { TileOutage } from './tile-outage';

/** The image URL for one tile, given the screen's pixel ratio. */
export type TileUrlFn = (tile: TileCoords, devicePixelRatio: number) => string;

/**
 * A tile layer for images NOAA's ImageServer renders on request (`exportImage`). There is no
 * `{z}/{x}/{y}` template for those, so each URL comes from a function, which also gets the screen's
 * pixel ratio so high-density screens can ask for 512 px images and keep the relief crisp.
 *
 * Rendering a tile takes the server a while, so a wider ring of tiles is kept around the view
 * (`keepBuffer`) and panning back does not ask for them again. With an `outage`, a server that
 * stops answering is left alone for a while (see {@link TileOutage}).
 */
export class NoaaExportTileLayer extends GuardedTileLayer {
  constructor(
    private readonly tileUrl: TileUrlFn,
    options: L.TileLayerOptions = {},
    outage?: TileOutage,
  ) {
    super('', { maxZoom: 15, keepBuffer: 4, ...options }, outage);
  }

  protected override sourceTileUrl(coords: L.Coords): string {
    return this.tileUrl(
      { x: coords.x, y: coords.y, z: coords.z },
      globalThis.devicePixelRatio || 1,
    );
  }
}
