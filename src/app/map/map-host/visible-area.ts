import * as L from 'leaflet';
import type { PanelInsets } from './frame-oahu';

/**
 * The part of a map of `size` that the panels leave uncovered, in container pixels. When the panels
 * would cover all of it (a tiny window), the whole map counts as visible.
 */
export function visibleArea(size: L.Point, insets: PanelInsets): L.Bounds {
  const left = insets.left;
  const top = insets.top;
  const right = size.x - insets.right;
  const bottom = size.y - insets.bottom;
  return right > left && bottom > top
    ? L.bounds([left, top], [right, bottom])
    : L.bounds([0, 0], [size.x, size.y]);
}

/** `area` with `share` of its width and height taken off each side. */
export function shrinkArea(area: L.Bounds, share: number): L.Bounds {
  const { x, y } = area.getSize();
  const inset = L.point(x * share, y * share);
  return L.bounds(area.getTopLeft().add(inset), area.getBottomRight().subtract(inset));
}

/**
 * The map centre that puts `target` at container point `at` once the map is at `zoom`: where to fly
 * so a spot lands in the middle of the visible area rather than behind a panel.
 */
export function centreShowing(map: L.Map, target: L.LatLng, zoom: number, at: L.Point): L.LatLng {
  const middle = map.getSize().divideBy(2);
  const projected = map.project(target, zoom).subtract(at.subtract(middle));
  return map.unproject(projected, zoom);
}
