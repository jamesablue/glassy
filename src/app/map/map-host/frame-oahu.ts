import * as L from 'leaflet';

/** The part of Oahu worth framing on first load: the whole coastline with its spots. */
export const OAHU_BOUNDS = L.latLngBounds([21.25, -158.29], [21.72, -157.64]);

/** Zoom used while the map has no size yet, so it has a sensible view to start from. */
const FALLBACK_ZOOM = 10;
/** Below this width the panels stack at the top and bottom of the screen. */
const NARROW_MAX_WIDTH = 760;
/** Above this width the side panel and the layer menu get more room. */
const ROOMY_MIN_WIDTH = 1000;

/** Space kept clear around the island for the panels, CSS pixels as `[x, y]`. */
export interface FramePadding {
  readonly topLeft: readonly [number, number];
  readonly bottomRight: readonly [number, number];
}

/**
 * Where the panels sit for a given map width. On a phone the brand sits at the top and the ranking
 * and timeline at the bottom; on wider screens the ranking takes the left and the layer menu and
 * legend the right.
 */
export function framePadding(width: number): FramePadding {
  if (width < NARROW_MAX_WIDTH) return { topLeft: [10, 60], bottomRight: [50, 130] };
  const roomy = width > ROOMY_MIN_WIDTH;
  return { topLeft: [roomy ? 350 : 250, 30], bottomRight: [roomy ? 170 : 120, 80] };
}

/**
 * Fits Oahu into the space the panels leave. A map that starts without a size (in a hidden tab or
 * container) gets a rough view first and is framed properly on its first resize.
 */
export function frameOahu(map: L.Map): void {
  const frame = (): boolean => {
    const size = map.getSize();
    if (!size.x || !size.y) {
      map.setView(OAHU_BOUNDS.getCenter(), FALLBACK_ZOOM);
      return false;
    }
    const padding = framePadding(size.x);
    // A first view appears in place: there is nothing to animate from.
    map.fitBounds(OAHU_BOUNDS, {
      paddingTopLeft: [...padding.topLeft],
      paddingBottomRight: [...padding.bottomRight],
      animate: false,
    });
    return true;
  };

  if (frame()) return;
  const frameOnResize = (): void => {
    if (frame()) map.off('resize', frameOnResize);
  };
  map.on('resize', frameOnResize);
}
