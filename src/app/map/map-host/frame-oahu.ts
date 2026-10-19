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

/** CSS pixels covered by the floating panels along each edge of the map. */
export interface PanelInsets {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}

/**
 * The phone sheet's height as a share of the screen (`max-height: 46vh` in
 * `app-shell.component.scss`); a spot's details always fill it.
 */
const SHEET_SHARE = 0.46;

/**
 * What the panels cover at a given map size, so a spot can be brought into the part of the map
 * that shows (see `app-shell.component.scss` and `tokens.scss` for where they sit):
 *
 * - on a phone, the brand along the top, the menu's icons on the right, and above the timeline the
 *   side panel's sheet: its folded header, or up to 46% of the height when it is open
 * - on wider screens, the side panel (`--side-width`) on the left, the layer menu and its labels on
 *   the right, and the timeline and legend along the bottom
 *
 * @param sheetOpen whether the side panel is open on a phone, as it is while a spot is selected
 */
export function panelInsets(width: number, height: number, sheetOpen: boolean): PanelInsets {
  if (width < NARROW_MAX_WIDTH) {
    const belowSheet = 96;
    const sheet = sheetOpen ? Math.round(height * SHEET_SHARE) : 60;
    return { top: 56, right: 52, bottom: belowSheet + sheet, left: 8 };
  }
  return { top: 12, right: 160, bottom: 90, left: 344 };
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
