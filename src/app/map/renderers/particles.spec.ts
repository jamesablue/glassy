import type { GridSpec } from '../../domain/models';
import { FakeContext2D } from '../../../testing/fake-canvas';
import {
  advect,
  flowAt,
  MAX_PARTICLES,
  PARTICLE_STYLES,
  particleCount,
  respawn,
  type Particle,
  type ScreenFlow,
  type Velocity,
} from './particles';

/** Random numbers from a fixed list, repeating. */
function sequence(...values: number[]): () => number {
  let next = 0;
  return () => values[next++ % values.length] ?? 0;
}

describe('particleCount', () => {
  it('gives wind more particles than the sea for the same view', () => {
    expect(particleCount(560, 100, PARTICLE_STYLES.wind)).toBe(200);
    expect(particleCount(520, 100, PARTICLE_STYLES.sea)).toBe(100);
  });

  it(`never exceeds ${MAX_PARTICLES}`, () => {
    expect(particleCount(4000, 3000, PARTICLE_STYLES.wind)).toBe(MAX_PARTICLES);
  });
});

describe('respawn', () => {
  it('places the particle at a random point in the view with a new lifetime', () => {
    const particle = respawn(
      { x: -5, y: -5, age: 99, lifetime: 1 },
      200,
      100,
      sequence(0.5, 0.25, 1),
    );
    expect(particle).toEqual({ x: 100, y: 25, lifetime: 110, age: 0 });
  });

  it('gives particles a random head start at start-up', () => {
    const particle = respawn(
      { x: 0, y: 0, age: 0, lifetime: 0 },
      10,
      10,
      sequence(0, 0, 0, 0.5),
      true,
    );
    expect(particle.lifetime).toBe(50);
    expect(particle.age).toBe(25);
  });
});

describe('flowAt', () => {
  const grid: GridSpec = { lat0: 0, lon0: 0, step: 1, rows: 2, cols: 2 };
  // Hour 0: 10 m/s towards the east. Hour 1: 10 m/s towards the north.
  const vectors = {
    u: Float32Array.of(10, 10, 10, 10, 0, 0, 0, 0),
    v: Float32Array.of(0, 0, 0, 0, 10, 10, 10, 10),
  };
  const flow = (overrides: Partial<ScreenFlow> = {}): ScreenFlow => ({
    grid,
    vectors,
    hour: 0,
    rows: Float32Array.of(0.5, 0.5),
    cols: Float32Array.of(0.5, NaN),
    speed: 0.1,
    ...overrides,
  });
  const out: Velocity = { dx: 0, dy: 0 };

  it('scales the vector to screen pixels per frame', () => {
    expect(flowAt(flow(), 0.7, 1.2, out)).toBe(true);
    expect(out.dx).toBe(1);
    expect(out.dy).toBeCloseTo(0, 10);
  });

  it('turns north into up the screen', () => {
    expect(flowAt(flow({ hour: 1 }), 0, 0, out)).toBe(true);
    expect(out.dx).toBe(0);
    expect(out.dy).toBe(-1);
  });

  it('has no flow too far outside the grid', () => {
    expect(flowAt(flow(), 1, 0, out)).toBe(false);
  });

  it('has no flow off the screen lookup', () => {
    expect(flowAt(flow(), 0, 5, out)).toBe(false);
  });

  it('has no flow where the forecast has no data', () => {
    const gappy = { u: Float32Array.of(NaN, 10, 10, 10), v: new Float32Array(4) };
    expect(flowAt(flow({ vectors: gappy }), 0, 0, out)).toBe(false);
  });
});

describe('advect', () => {
  const grid: GridSpec = { lat0: 0, lon0: 0, step: 1, rows: 2, cols: 2 };
  // 10 m/s towards the north-east everywhere; at speed 0.1 that is 1 px right and 1 px up per frame.
  const flow: ScreenFlow = {
    grid,
    vectors: { u: new Float32Array(4).fill(10), v: new Float32Array(4).fill(10) },
    hour: 0,
    rows: new Float32Array(20).fill(0.5),
    cols: Float32Array.from({ length: 20 }, (_, x) => (x < 15 ? 0.5 : NaN)),
    speed: 0.1,
  };
  const particle = (x: number, y: number, age = 0, lifetime = 100): Particle => ({
    x,
    y,
    age,
    lifetime,
  });

  it('moves particles along the flow and draws each step', () => {
    const particles = [particle(5, 5), particle(10, 12)];
    const path = new FakeContext2D();
    advect(particles, flow, 20, 20, sequence(0.5), path);
    expect(particles).toEqual([particle(6, 4, 1), particle(11, 11, 1)]);
    expect(path.path).toEqual([
      [5, 5, 6, 4],
      [10, 12, 11, 11],
    ]);
  });

  it('respawns particles that have lived their lifetime', () => {
    const particles = [particle(5, 5, 50, 50)];
    const path = new FakeContext2D();
    advect(particles, flow, 20, 20, sequence(0.5), path);
    expect(particles[0]).toEqual({ x: 10, y: 10, lifetime: 80, age: 0 });
    expect(path.path).toEqual([]);
  });

  it('respawns particles that have left the view', () => {
    const particles = [particle(-1, 5), particle(5, 20), particle(20, 5), particle(5, -0.5)];
    const path = new FakeContext2D();
    advect(particles, flow, 20, 20, sequence(0.25), path);
    expect(particles.every((p) => p.x === 5 && p.y === 5 && p.age === 0)).toBe(true);
    expect(path.path).toEqual([]);
  });

  it('respawns particles where there is no flow', () => {
    const particles = [particle(16, 5)];
    advect(particles, flow, 20, 20, sequence(0.25), new FakeContext2D());
    expect(particles[0]).toMatchObject({ x: 5, y: 5, age: 0 });
  });
});
