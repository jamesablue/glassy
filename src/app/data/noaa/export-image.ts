import type { TileCoords } from '../../core/terrain-tile-sources';
import type { RasterFunction } from './raster-functions';

/** Projected bounds in EPSG:3857 metres. */
export type Bbox = readonly [xmin: number, ymin: number, xmax: number, ymax: number];

/** Half the width of the Web Mercator world, metres. */
const HALF_WORLD_M = 20037508.342789244;

/** A tile's Web Mercator bounds: the world square split into 2^z × 2^z tiles, row 0 at the top. */
export function tileBbox(tile: TileCoords): Bbox {
  const size = (2 * HALF_WORLD_M) / 2 ** tile.z;
  const xmin = -HALF_WORLD_M + tile.x * size;
  const ymax = HALF_WORLD_M - tile.y * size;
  return [xmin, ymax - size, xmin + size, ymax];
}

/** Image size for a 256 px map tile: double resolution on high-density screens keeps edges crisp. */
export function tilePixelSize(devicePixelRatio: number): 256 | 512 {
  return devicePixelRatio > 1.4 ? 512 : 256;
}

/**
 * An ImageServer `exportImage` URL that renders one map tile with a raster function. NOAA has no
 * pre-rendered tiles for these rules, so each tile asks the server to render its own bbox.
 * https://developers.arcgis.com/rest/services-reference/enterprise/export-image/
 */
export function exportImageTileUrl(
  tile: TileCoords,
  rule: RasterFunction,
  pixelSize: number,
  baseUrl: string,
): string {
  return (
    `${baseUrl}/exportImage?bbox=${tileBbox(tile).join(',')}&bboxSR=3857&imageSR=3857` +
    `&size=${pixelSize},${pixelSize}&format=png32&transparent=true` +
    `&interpolation=RSP_BilinearInterpolation` +
    `&renderingRule=${encodeURIComponent(JSON.stringify(rule))}&f=image`
  );
}
