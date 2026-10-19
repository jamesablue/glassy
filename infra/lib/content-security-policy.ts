/**
 * Third-party origins the app is allowed to reach, by what it uses them for.
 *
 * This is the one place to edit when the app starts (or stops) talking to a
 * host. Keep it in step with the data clients and map layers in `src/app`: a
 * host that is missing here works in `ng serve` but is blocked in production.
 */
export const CSP_THIRD_PARTY_ORIGINS = {
  /** Map tiles: the Esri canvas basemap and NOAA bathymetry images. */
  images: ['https://server.arcgisonline.com', 'https://gis.ngdc.noaa.gov'],
  /** fetch() calls: Open-Meteo marine and weather forecasts, NOAA depth lookups. */
  connect: [
    'https://marine-api.open-meteo.com',
    'https://api.open-meteo.com',
    'https://gis.ngdc.noaa.gov',
  ],
} as const;

/**
 * Directives of the Content-Security-Policy header that CloudFront adds to
 * every response. Everything not listed falls back to `default-src 'self'`.
 */
export const CSP_DIRECTIVES: Readonly<Record<string, readonly string[]>> = {
  'default-src': ["'self'"],
  // The production build has no inline scripts. The deploy workflow fails the
  // build if one appears (for example Angular's critical CSS loader script).
  'script-src': ["'self'"],
  // Angular adds component styles as <style> elements at runtime, so inline
  // styles must be allowed. Nonces would need a server to mint one per
  // request, which a static S3 site does not have. Styles cannot run code, so
  // this is a much smaller risk than inline scripts.
  'style-src': ["'self'", "'unsafe-inline'"],
  // data: and blob: cover inline SVG icons and images generated from canvases.
  'img-src': ["'self'", 'data:', 'blob:', ...CSP_THIRD_PARTY_ORIGINS.images],
  'connect-src': ["'self'", ...CSP_THIRD_PARTY_ORIGINS.connect],
  'font-src': ["'self'"],
  'object-src': ["'none'"],
  'frame-ancestors': ["'none'"],
  'base-uri': ["'self'"],
  'form-action': ["'self'"],
};

/** Serialises directives into a header value: `name source source; name source`. */
export function buildContentSecurityPolicy(
  directives: Readonly<Record<string, readonly string[]>> = CSP_DIRECTIVES,
): string {
  return Object.entries(directives)
    .map(([name, sources]) => [name, ...sources].join(' '))
    .join('; ');
}

/** CloudFront rejects a Content-Security-Policy value longer than this. */
export const CLOUDFRONT_CSP_MAX_LENGTH = 1783;
