import { InjectionToken } from '@angular/core';

/** A slippy-map tile: column `x` and row `y` (from the top) at zoom `z`. */
export interface TileCoords {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/**
 * Where the map's terrain tiles come from: shaded relief for the land and colour-coded water depth.
 *
 * The map layer only knows this interface and the data layer implements it, so the map can show
 * NOAA tiles without importing the code that builds NOAA requests.
 */
export interface TerrainTileSources {
  /**
   * The image URL for one tile of land hillshade.
   *
   * @param devicePixelRatio the screen's pixel ratio, so high-density screens can get sharper images
   */
  landTileUrl(tile: TileCoords, devicePixelRatio: number): string;
  /** The image URL for one tile of water depth classes. Land is transparent. */
  depthTileUrl(tile: TileCoords, devicePixelRatio: number): string;
}

/**
 * The app's {@link TerrainTileSources}. Like `GLASSY_CONFIG` it has no default: the app wires the
 * NOAA implementation in `app.config.ts`, and tests provide their own.
 */
export const TERRAIN_TILE_SOURCES = new InjectionToken<TerrainTileSources>('TERRAIN_TILE_SOURCES');
