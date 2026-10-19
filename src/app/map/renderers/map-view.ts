import type { LatLon } from '../../domain/models';

/** A position in CSS pixels. */
export interface ScreenPoint {
  readonly x: number;
  readonly y: number;
}

/** Turns a point in the map container (CSS pixels from its top-left corner) into coordinates. */
export type ContainerToLatLon = (x: number, y: number) => LatLon;

/**
 * What a renderer needs to know about the map: the view's size, where its top-left corner sits in
 * the pane the canvas lives in, and how screen points map to coordinates. Plain data and a
 * callback, so the renderers depend on neither Angular nor Leaflet and could move to a worker.
 */
export interface MapView {
  /** CSS pixels. */
  readonly width: number;
  readonly height: number;
  /** The container's top-left corner in pane coordinates, where a canvas covering the view goes. */
  readonly origin: ScreenPoint;
  readonly toLatLon: ContainerToLatLon;
}

/** Moves a canvas so its top-left corner sits at `origin` in its pane. */
export function placeCanvas(canvas: HTMLCanvasElement, origin: ScreenPoint): void {
  canvas.style.transform = `translate3d(${origin.x}px, ${origin.y}px, 0)`;
}
