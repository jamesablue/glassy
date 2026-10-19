import type { GridSpec } from '../../domain/models';
import { FakeAnimationHost } from '../../../testing/fake-animation-host';
import { fakeCanvas, type FakeContext2D } from '../../../testing/fake-canvas';
import type { MapView } from './map-view';
import { ParticleSystem, type ParticleField } from './particle-system';
import { PARTICLE_STYLES } from './particles';

describe('ParticleSystem', () => {
  const grid: GridSpec = { lat0: 21, lon0: -158, step: 1, rows: 2, cols: 2 };
  // Hour 0: 10 m/s towards the east. Hour 1: 10 m/s towards the north.
  const field: ParticleField = {
    grid,
    vectors: {
      u: Float32Array.of(10, 10, 10, 10, 0, 0, 0, 0),
      v: Float32Array.of(0, 0, 0, 0, 10, 10, 10, 10),
    },
    style: PARTICLE_STYLES.wind,
  };
  // 280 × 100 CSS pixels inside the grid: 100 wind particles.
  const view: MapView = {
    width: 280,
    height: 100,
    origin: { x: 5, y: -7 },
    toLatLon: () => ({ lat: 21.5, lon: -157.5 }),
  };

  let host: FakeAnimationHost;
  let canvas: HTMLCanvasElement;
  let context: FakeContext2D;
  let particles: ParticleSystem;

  beforeEach(() => {
    host = new FakeAnimationHost();
    ({ canvas, context } = fakeCanvas());
    // Fixed random numbers put every particle in the middle of the view with a 50-frame life.
    particles = new ParticleSystem(canvas, host, () => 0.5);
  });

  const lastStroke = (): readonly (readonly number[])[] => context.strokes.at(-1) ?? [];
  /** The first particle's segment in the last frame, rounded to 0.01 px. */
  const firstSegment = (): number[] =>
    (lastStroke()[0] ?? []).map((value) => Math.round(value * 100) / 100);

  it('animates one frame at a time once started', () => {
    particles.start(view, field, 0);
    expect(particles.running).toBe(true);
    expect(host.pendingFrames).toBe(1);

    host.runFrames();
    expect(host.pendingFrames).toBe(1);
    expect(lastStroke()).toHaveLength(100);
  });

  it('dims the previous frame before drawing the next', () => {
    particles.start(view, field, 0);
    host.runFrames();
    expect(context.fills).toEqual([{ style: 'rgba(0,0,0,0.9)', operation: 'destination-in' }]);
    expect(context.globalCompositeOperation).toBe('source-over');
    expect(context.strokeStyle).toBe(PARTICLE_STYLES.wind.color);
    expect(context.lineWidth).toBe(PARTICLE_STYLES.wind.lineWidth);
  });

  it('moves the particles along the field', () => {
    particles.start(view, field, 0);
    host.runFrames();
    // 10 m/s × 0.14 px per frame per m/s, towards the east.
    expect(firstSegment()).toEqual([140, 50, 141.4, 50]);
  });

  it('follows a new hour without placing the particles again', () => {
    particles.start(view, field, 0);
    host.runFrames();
    particles.setHour(1);
    host.runFrames();
    // From where the last frame left it, now towards the north (up the screen).
    expect(firstSegment()).toEqual([141.4, 50, 141.4, 48.6]);
  });

  it('starts at the hour it is given', () => {
    particles.setHour(1);
    particles.start(view, field, 1);
    host.runFrames();
    expect(firstSegment()).toEqual([140, 50, 140, 48.6]);
  });

  it('covers the view on a canvas up to twice as dense as CSS pixels', () => {
    host.devicePixelRatio = 3;
    particles.start(view, field, 0);
    expect([canvas.width, canvas.height]).toEqual([560, 200]);
    expect(canvas.style.width).toBe('280px');
    expect(canvas.style.height).toBe('100px');
    expect(canvas.style.transform).toBe('translate3d(5px, -7px, 0)');
    expect(context.transform).toEqual([2, 0, 0, 2, 0, 0]);
  });

  it('draws in CSS pixels on ordinary screens', () => {
    host.devicePixelRatio = 0;
    particles.start(view, field, 0);
    expect([canvas.width, canvas.height]).toEqual([280, 100]);
  });

  it('stops and clears the canvas', () => {
    particles.start(view, field, 0);
    const clears = context.clears;
    particles.stop();
    expect(particles.running).toBe(false);
    expect(host.pendingFrames).toBe(0);
    expect(context.clears).toBe(clears + 1);
  });

  it('does not start while the map has no size', () => {
    particles.start({ ...view, width: 0 }, field, 0);
    expect(particles.running).toBe(false);
  });

  it('does not start without a 2D context', () => {
    const blank = document.createElement('canvas');
    Object.defineProperty(blank, 'getContext', { value: () => null });
    const system = new ParticleSystem(blank, host);
    system.start(view, field, 0);
    expect(system.running).toBe(false);
  });

  describe('reduced motion', () => {
    it('never starts when the user prefers reduced motion', () => {
      host.reducedMotion.set(true);
      particles.start(view, field, 0);
      expect(particles.running).toBe(false);
      expect(host.pendingFrames).toBe(0);
    });

    it('stops when the preference is turned on and resumes when it is turned off', () => {
      particles.start(view, field, 0);
      host.reducedMotion.set(true);
      expect(particles.running).toBe(false);
      host.reducedMotion.set(false);
      expect(particles.running).toBe(true);
    });
  });

  describe('page visibility', () => {
    it('pauses while the page is hidden and resumes when it is shown', () => {
      particles.start(view, field, 0);
      host.document.setHidden(true);
      expect(particles.running).toBe(false);
      expect(host.pendingFrames).toBe(0);
      host.document.setHidden(false);
      expect(particles.running).toBe(true);
    });

    it('stays stopped when the page is shown again after a stop', () => {
      particles.start(view, field, 0);
      particles.stop();
      host.document.setHidden(true);
      host.document.setHidden(false);
      expect(particles.running).toBe(false);
    });
  });

  it('lets go of the page listeners when destroyed', () => {
    particles.start(view, field, 0);
    particles.destroy();
    expect(particles.running).toBe(false);
    expect(host.reducedMotion.listenerCount).toBe(0);
    expect(host.document.listenerCount).toBe(0);
  });
});
