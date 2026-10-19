import type { MapView } from './map-view';
import { placeCanvas } from './map-view';
import { paintField, type FieldPaint } from './paint-field';
import { buildViewportLookup } from './viewport-lookup';

/**
 * CSS pixels per canvas pixel. The forecast grid is 1/8° (about 14 km), so full resolution would
 * only paint the same smooth gradient nine times slower; the browser's upscaling smooths it further.
 */
export const FIELD_SCALE = 3;

/**
 * Paints a forecast field as a colour overlay covering the map view. It draws on demand (the caller
 * redraws after the map moves or the hour or layer changes) and keeps no state beyond its canvas.
 */
export class ScalarFieldRenderer {
  private readonly context: CanvasRenderingContext2D | null;
  private pixels: ImageData | undefined;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.context = canvas.getContext('2d');
  }

  /** Paints `field` over `view`, or hides the canvas when there is no field to show. */
  draw(view: MapView, field: FieldPaint | undefined): void {
    const { canvas, context } = this;
    if (!field || !context) {
      canvas.style.display = 'none';
      return;
    }
    const width = Math.ceil(view.width / FIELD_SCALE);
    const height = Math.ceil(view.height / FIELD_SCALE);
    if (!width || !height) return;

    canvas.style.display = '';
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      this.pixels = undefined;
    }
    canvas.style.width = `${width * FIELD_SCALE}px`;
    canvas.style.height = `${height * FIELD_SCALE}px`;
    placeCanvas(canvas, view.origin);

    const sampling = { width, height, scale: FIELD_SCALE, offset: 0.5 };
    const lookup = buildViewportLookup(field.grid, view.toLatLon, sampling);
    this.pixels ??= context.createImageData(width, height);
    paintField(this.pixels, lookup, field);
    context.putImageData(this.pixels, 0, 0);
  }

  /**
   * Fades the overlay out or back in. It cannot follow Leaflet's zoom animation, so it hides while
   * the map zooms and comes back with the next draw.
   */
  setVisible(visible: boolean): void {
    this.canvas.style.opacity = visible ? '1' : '0';
  }
}
