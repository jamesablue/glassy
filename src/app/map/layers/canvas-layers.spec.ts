import { Component, signal } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { FakeAnimationHost } from '../../../testing/fake-animation-host';
import { installFakeCanvas, type FakeContext2D } from '../../../testing/fake-canvas';
import { renderMap, resizeMap } from '../../../testing/map-harness';
import { PALETTES } from '../../domain/color';
import { toVectorField } from '../../domain/grid';
import type { GridSpec, Palette, VectorField } from '../../domain/models';
import { MapHostComponent } from '../map-host/map-host.component';
import { MAP_PANES, PARTICLES_OVER_LAND } from '../map-host/map-panes';
import { ParticleSystem } from '../renderers/particle-system';
import type { ParticleMode } from '../renderers/particles';
import { ANIMATION_HOST, ParticleLayerComponent } from './particle-layer.component';
import { ScalarFieldLayerComponent } from './scalar-field-layer.component';

/** A 1/8° grid over Oahu with two hours of uniform values. */
const GRID: GridSpec = { lat0: 20.875, lon0: -158.875, step: 0.125, rows: 11, cols: 15 };
const CELLS = GRID.rows * GRID.cols;
const uniform = (first: number, second: number): Float32Array =>
  Float32Array.from({ length: 2 * CELLS }, (_, k) => (k < CELLS ? first : second));
const WAVES = uniform(1, 3);
const WIND: VectorField = toVectorField(uniform(8, 8), uniform(70, 250));

@Component({
  imports: [MapHostComponent, ScalarFieldLayerComponent, ParticleLayerComponent],
  template: `
    <glassy-map>
      @if (shown()) {
        <glassy-scalar-field-layer
          [field]="field()"
          [grid]="grid"
          [palette]="palette()"
          [hour]="hour()"
        />
        <glassy-particle-layer
          [vectors]="vectors()"
          [grid]="grid"
          [hour]="hour()"
          [mode]="mode()"
          [enabled]="enabled()"
        />
      }
    </glassy-map>
  `,
})
class HostComponent {
  readonly grid = GRID;
  readonly shown = signal(true);
  readonly field = signal<Float32Array | undefined>(WAVES);
  readonly palette = signal<Palette | undefined>(PALETTES.waves);
  readonly vectors = signal<VectorField | undefined>(WIND);
  readonly hour = signal(0);
  readonly mode = signal<ParticleMode>('sea');
  readonly enabled = signal(true);
}

describe('canvas layers', () => {
  let canvases: ReturnType<typeof installFakeCanvas>;
  let animation: FakeAnimationHost;

  beforeEach(() => {
    canvases = installFakeCanvas();
    animation = new FakeAnimationHost();
    TestBed.configureTestingModule({
      providers: [{ provide: ANIMATION_HOST, useValue: animation }],
    });
  });

  afterEach(() => canvases.restore());

  async function setup() {
    const fixture = TestBed.createComponent(HostComponent);
    const map = await renderMap(fixture);
    resizeMap(fixture, 600, 400);
    return { fixture, map, host: fixture.componentInstance };
  }

  function update(fixture: ComponentFixture<HostComponent>): void {
    fixture.detectChanges();
    TestBed.tick();
  }

  const fieldCanvas = (): HTMLCanvasElement | null =>
    document.querySelector<HTMLCanvasElement>('.leaflet-field-pane > .field-canvas');
  const particleCanvas = (): HTMLCanvasElement | null =>
    document.querySelector<HTMLCanvasElement>('.leaflet-particles-pane > .particle-canvas');
  const contextOf = (canvas: HTMLCanvasElement | null): FakeContext2D => {
    const context = canvas?.getContext('2d') as unknown as FakeContext2D | undefined;
    if (!context) throw new Error('No canvas');
    return context;
  };

  describe('ScalarFieldLayerComponent', () => {
    it('paints the field over the view at a third of the resolution', async () => {
      await setup();
      const canvas = fieldCanvas();
      expect([canvas?.width, canvas?.height]).toEqual([200, 134]);
      expect(contextOf(canvas).putImages.length).toBeGreaterThan(0);
      expect(canvas?.style.opacity).toBe('1');
    });

    it('paints the selected hour in the palette colours', async () => {
      const { fixture, host } = await setup();
      const context = contextOf(fieldCanvas());
      const centre = (): number[] => {
        const image = context.putImages.at(-1);
        const offset = (67 * (image?.width ?? 0) + 100) * 4;
        return Array.from(image?.data.subarray(offset, offset + 3) ?? []);
      };
      const first = centre();
      host.hour.set(1);
      update(fixture);
      expect(centre()).not.toEqual(first);
    });

    it('paints once per change and not again when nothing changed', async () => {
      const { fixture, host } = await setup();
      const context = contextOf(fieldCanvas());
      const draws = context.putImages.length;

      host.hour.set(1);
      update(fixture);
      expect(context.putImages.length).toBe(draws + 1);

      host.hour.set(1);
      host.palette.set(PALETTES.waves);
      update(fixture);
      update(fixture);
      expect(context.putImages.length).toBe(draws + 1);
    });

    it('hides while the map zooms and redraws when it settles', async () => {
      const { map } = await setup();
      const canvas = fieldCanvas();
      const draws = contextOf(canvas).putImages.length;

      map.fire('zoomstart');
      TestBed.tick();
      expect(canvas?.style.opacity).toBe('0');

      map.fire('moveend');
      TestBed.tick();
      expect(canvas?.style.opacity).toBe('1');
      expect(contextOf(canvas).putImages.length).toBe(draws + 1);
    });

    it('hides the canvas when there is no field, as on the depth layer', async () => {
      const { fixture, host } = await setup();
      host.field.set(undefined);
      update(fixture);
      expect(fieldCanvas()?.style.display).toBe('none');
    });
  });

  describe('ParticleLayerComponent', () => {
    it('animates once the map has a size', async () => {
      await setup();
      expect(particleCanvas()).not.toBeNull();
      expect(animation.pendingFrames).toBe(1);
      animation.runFrames(2);
      expect(contextOf(particleCanvas()).strokes).toHaveLength(2);
    });

    it('stops while the map moves and starts again when it settles', async () => {
      const { map } = await setup();
      map.fire('movestart');
      TestBed.tick();
      expect(animation.pendingFrames).toBe(0);

      map.fire('moveend');
      TestBed.tick();
      expect(animation.pendingFrames).toBe(1);
    });

    it('follows a new hour without starting over', async () => {
      const start = vi.spyOn(ParticleSystem.prototype, 'start');
      const setHour = vi.spyOn(ParticleSystem.prototype, 'setHour');
      const { fixture, host } = await setup();
      const starts = start.mock.calls.length;

      host.hour.set(1);
      update(fixture);
      expect(setHour).toHaveBeenLastCalledWith(1);
      expect(start.mock.calls.length).toBe(starts);
    });

    it('stops when particles are turned off or there are no vectors', async () => {
      const { fixture, host } = await setup();
      host.enabled.set(false);
      update(fixture);
      expect(animation.pendingFrames).toBe(0);

      host.enabled.set(true);
      host.vectors.set(undefined);
      update(fixture);
      expect(animation.pendingFrames).toBe(0);
    });

    it('never starts when the user prefers reduced motion', async () => {
      animation.reducedMotion.set(true);
      await setup();
      expect(animation.pendingFrames).toBe(0);
    });

    it('lets wind streaks cross the land and keeps wave streaks at sea', async () => {
      const { fixture, host, map } = await setup();
      const pane = map.getPane('particles');
      expect(pane?.style.zIndex).toBe(String(MAP_PANES.particles));

      host.mode.set('wind');
      update(fixture);
      expect(pane?.style.zIndex).toBe(String(PARTICLES_OVER_LAND));
    });
  });

  it('removes both canvases and the animation when destroyed', async () => {
    const { fixture, host } = await setup();
    host.shown.set(false);
    update(fixture);

    expect(fieldCanvas()).toBeNull();
    expect(particleCanvas()).toBeNull();
    expect(animation.pendingFrames).toBe(0);
    expect(animation.reducedMotion.listenerCount).toBe(0);
    expect(animation.document.listenerCount).toBe(0);
  });
});
