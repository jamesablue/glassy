import type { LatLon } from '../../domain/models';

/**
 * The parts of an ImageServer `identify` response we read. `value` is the pixel value as text, or
 * "NoData". ArcGIS reports failures with HTTP 200 and an `error` body instead of a `value`.
 * https://developers.arcgis.com/rest/services-reference/enterprise/identify-image-service/
 */
export interface IdentifyResponse {
  readonly value?: string;
  readonly error?: { readonly code: number; readonly message: string };
}

/** The `identify` URL for a WGS 84 point, without catalog items or geometry to keep it small. */
export function identifyUrl(baseUrl: string, point: LatLon): string {
  const geometry = JSON.stringify({ x: point.lon, y: point.lat, spatialReference: { wkid: 4326 } });
  return (
    `${baseUrl}/identify?geometry=${encodeURIComponent(geometry)}` +
    `&geometryType=esriGeometryPoint&returnGeometry=false&returnCatalogItems=false&f=json`
  );
}

/** A pixel value as a number: `NaN` for "NoData", blanks and anything else that is not finite. */
export function parsePixelValue(value: string): number {
  const trimmed = value.trim();
  const number = trimmed === '' ? NaN : Number(trimmed);
  return Number.isFinite(number) ? number : NaN;
}
