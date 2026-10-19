import {
  inject,
  Injectable,
  makeEnvironmentProviders,
  type EnvironmentProviders,
} from '@angular/core';
import { GLASSY_CONFIG } from '../../core/glassy-config.token';
import {
  TERRAIN_TILE_SOURCES,
  type TerrainTileSources,
  type TileCoords,
} from '../../core/terrain-tile-sources';
import { exportImageTileUrl, tilePixelSize } from './export-image';
import { DEPTH_RULE, LAND_RULE } from './raster-functions';

/** Terrain tiles rendered on request by NOAA's DEM ImageServer with the land and depth rules. */
@Injectable()
export class NoaaTerrainTileSources implements TerrainTileSources {
  private readonly baseUrl = inject(GLASSY_CONFIG).noaaDemUrl;

  landTileUrl(tile: TileCoords, devicePixelRatio: number): string {
    return exportImageTileUrl(tile, LAND_RULE, tilePixelSize(devicePixelRatio), this.baseUrl);
  }

  depthTileUrl(tile: TileCoords, devicePixelRatio: number): string {
    return exportImageTileUrl(tile, DEPTH_RULE, tilePixelSize(devicePixelRatio), this.baseUrl);
  }
}

/** Provides {@link TERRAIN_TILE_SOURCES} from NOAA, for the map's terrain and depth layers. */
export function provideNoaaTileSources(): EnvironmentProviders {
  return makeEnvironmentProviders([
    { provide: TERRAIN_TILE_SOURCES, useClass: NoaaTerrainTileSources },
  ]);
}
