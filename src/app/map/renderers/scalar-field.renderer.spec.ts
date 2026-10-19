import { buildLut, PALETTES } from '../../domain/color';
import type { GridSpec } from '../../domain/models';
import { fakeCanvas } from '../../../testing/fake-canvas';
import type { MapView } from './map-view';
import { FIELD_ALPHA, type FieldPaint } from './paint-field';
import { FIELD_SCALE, ScalarFieldRenderer } from './scalar-field.renderer';

describe('ScalarFieldRenderer', () => {
  const grid: GridSpec = { lat0: 21, lon0: -158, step: 1, rows: 2, cols: 2 };
  // The whole view sits inside the grid.
  const view = (width = 100, height = 50): MapView => ({
    width,
    height,
    origin: { x: -40, y: 12 },
    toLatLon: () => ({ lat: 21.5, lon: -157.5 }),
  });
  const field: FieldPaint = {
    grid,
    values: new Float32Array(4).fill(2),
    hour: 0,
    lut: buildLut(PALETTES.waves),
    max: PALETTES.waves.max,
  };

  it('paints a third-resolution canvas and lets CSS scale it up to cover the view', () => {
    const { canvas, context } = fakeCanvas();
    new ScalarFieldRenderer(canvas).draw(view(100, 50), field);

    expect([canvas.width, canvas.height]).toEqual([34, 17]);
    expect(canvas.style.width).toBe(`${34 * FIELD_SCALE}px`);
    expect(canvas.style.height).toBe(`${17 * FIELD_SCALE}px`);
    expect(canvas.style.transform).toBe('translate3d(-40px, 12px, 0)');
    expect(canvas.style.display).toBe('');

    const [image] = context.putImages;
    expect(image?.width).toBe(34);
    expect(image?.data[3]).toBe(FIELD_ALPHA);
  });

  it('reuses its pixel buffer until the view changes size', () => {
    const { canvas, context } = fakeCanvas();
    const renderer = new ScalarFieldRenderer(canvas);
    renderer.draw(view(), field);
    renderer.draw(view(), { ...field, hour: 0 });
    renderer.draw(view(200, 50), field);

    const [first, second, third] = context.putImages;
    expect(second).toBe(first);
    expect(third).not.toBe(first);
    expect(third?.width).toBe(67);
  });

  it('hides the canvas when there is no field to show', () => {
    const { canvas, context } = fakeCanvas();
    new ScalarFieldRenderer(canvas).draw(view(), undefined);
    expect(canvas.style.display).toBe('none');
    expect(context.putImages).toEqual([]);
  });

  it('draws nothing while the map has no size', () => {
    const { canvas, context } = fakeCanvas();
    new ScalarFieldRenderer(canvas).draw(view(0, 0), field);
    expect(context.putImages).toEqual([]);
  });

  it('draws nothing without a 2D context', () => {
    const canvas = document.createElement('canvas');
    Object.defineProperty(canvas, 'getContext', { value: () => null });
    new ScalarFieldRenderer(canvas).draw(view(), field);
    expect(canvas.style.display).toBe('none');
  });

  it('fades out and back in', () => {
    const { canvas } = fakeCanvas();
    const renderer = new ScalarFieldRenderer(canvas);
    renderer.setVisible(false);
    expect(canvas.style.opacity).toBe('0');
    renderer.setVisible(true);
    expect(canvas.style.opacity).toBe('1');
  });
});
