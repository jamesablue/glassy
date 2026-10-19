import { DOCUMENT } from '@angular/common';
import { Component, computed, effect, inject, input } from '@angular/core';
import { buildLut } from '../../domain/color';
import type { GridSpec, Palette } from '../../domain/models';
import { mapView, MapContext } from '../map-host/map-context';
import type { FieldPaint } from '../renderers/paint-field';
import { ScalarFieldRenderer } from '../renderers/scalar-field.renderer';
import { CanvasOverlay } from './canvas-overlay';
import { keepLayerOnMap } from './keep-layer-on-map';

/**
 * A forecast field (wind speed, wave height, swell period…) as a colour overlay in the `field` pane.
 * It redraws when the map settles after a move or zoom, and when the field, palette or hour changes.
 * Without a field (on the depth layer, or before the forecast loads) it draws nothing.
 */
@Component({ selector: 'glassy-scalar-field-layer', template: '' })
export class ScalarFieldLayerComponent {
  /** The field for every forecast hour, laid out like `GridForecast.fields`. */
  readonly field = input<Float32Array | undefined>();
  readonly grid = input<GridSpec | undefined>();
  readonly palette = input<Palette | undefined>();
  readonly hour = input(0);

  private readonly lut = computed(() => {
    const palette = this.palette();
    return palette ? buildLut(palette) : undefined;
  });
  private readonly paint = computed<FieldPaint | undefined>(() => {
    const values = this.field();
    const grid = this.grid();
    const palette = this.palette();
    const lut = this.lut();
    if (!values || !grid || !palette || !lut) return undefined;
    return { grid, values, hour: this.hour(), lut, max: palette.max };
  });

  constructor() {
    const context = inject(MapContext);
    const canvas = inject(DOCUMENT).createElement('canvas');
    canvas.className = 'field-canvas';
    const renderer = new ScalarFieldRenderer(canvas);
    keepLayerOnMap(new CanvasOverlay(canvas, 'field'));

    effect(() => {
      const map = context.map();
      if (!map || !context.viewport()) return;
      if (context.zooming()) {
        renderer.setVisible(false);
        return;
      }
      renderer.draw(mapView(map), this.paint());
      renderer.setVisible(true);
    });
  }
}
