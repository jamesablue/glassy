import { bilinear } from '../../domain/grid';
import { valueAt } from '../../domain/math';
import type { GridSpec, VectorField } from '../../domain/models';

/** Wind streaks race across land and sea; wave and swell streaks drift slowly and stay at sea. */
export type ParticleMode = 'wind' | 'sea';

/** How one kind of particle looks and moves. */
export interface ParticleStyle {
  /**
   * Screen pixels per frame for each unit of the vector field: per m/s of wind, or per second of
   * wave period (wave groups travel at a speed proportional to their period).
   */
  readonly speed: number;
  /** CSS pixels² of map per particle, so the density is the same on every screen size. */
  readonly areaPerParticle: number;
  /** Share of each trail kept from one frame to the next: higher leaves longer trails. */
  readonly fade: number;
  readonly color: string;
  /** CSS pixels. */
  readonly lineWidth: number;
}

export const PARTICLE_STYLES: Readonly<Record<ParticleMode, ParticleStyle>> = {
  wind: {
    speed: 0.14,
    areaPerParticle: 280,
    fade: 0.9,
    color: 'rgba(255,255,255,0.85)',
    lineWidth: 1.1,
  },
  sea: {
    speed: 0.075,
    areaPerParticle: 520,
    fade: 0.95,
    color: 'rgba(255,255,255,0.6)',
    lineWidth: 1.6,
  },
};

/** Enough to fill a large monitor; more only costs frame time. */
export const MAX_PARTICLES = 5000;
/**
 * Particles are only drawn this close to the grid (in cells). Further out, the edge values the grid
 * is clamped to would show flow the forecast does not have.
 */
export const MAX_CELLS_OUTSIDE = 0.3;
/** Particles live 50 to 110 frames, so they do not all respawn at once. */
const MIN_LIFETIME = 50;
const LIFETIME_SPREAD = 60;

export interface Particle {
  /** CSS pixels from the canvas's top-left corner. */
  x: number;
  y: number;
  /** Frames lived so far. */
  age: number;
  /** Frames to live. */
  lifetime: number;
}

/** A source of numbers in [0, 1), `Math.random` unless a test supplies its own. */
export type Random = () => number;

/** How many particles a view of this size gets. */
export function particleCount(width: number, height: number, style: ParticleStyle): number {
  return Math.min(MAX_PARTICLES, Math.round((width * height) / style.areaPerParticle));
}

/**
 * Puts a particle somewhere new in the view with a new lifetime. At start-up `randomAge` gives each
 * one a head start, so they do not all respawn on the same frame.
 */
export function respawn(
  particle: Particle,
  width: number,
  height: number,
  random: Random,
  randomAge = false,
): Particle {
  particle.x = random() * width;
  particle.y = random() * height;
  particle.lifetime = MIN_LIFETIME + random() * LIFETIME_SPREAD;
  particle.age = randomAge ? random() * particle.lifetime : 0;
  return particle;
}

/** A vector field projected onto the screen: what particles move along. */
export interface ScreenFlow {
  readonly grid: GridSpec;
  readonly vectors: VectorField;
  hour: number;
  /** Grid row for each screen row, `NaN` where it is too far outside the grid. */
  readonly rows: Float32Array;
  /** Grid column for each screen column, `NaN` where it is too far outside the grid. */
  readonly cols: Float32Array;
  readonly speed: number;
}

/** A particle's motion for one frame, screen pixels. */
export interface Velocity {
  dx: number;
  dy: number;
}

/**
 * The flow at a screen point, written into `out` (reused to avoid an allocation per particle per
 * frame). Returns false where there is no flow: off the grid or where the forecast has no data.
 */
export function flowAt(flow: ScreenFlow, x: number, y: number, out: Velocity): boolean {
  const row = valueAt(flow.rows, Math.trunc(y));
  const col = valueAt(flow.cols, Math.trunc(x));
  if (Number.isNaN(row) || Number.isNaN(col)) return false;
  const u = bilinear(flow.grid, flow.vectors.u, flow.hour, row, col);
  const v = bilinear(flow.grid, flow.vectors.v, flow.hour, row, col);
  if (!Number.isFinite(u) || !Number.isFinite(v)) return false;
  out.dx = u * flow.speed;
  // Screen y grows downwards, north is up.
  out.dy = -v * flow.speed;
  return true;
}

/** Where trail segments are drawn: a canvas 2D context, or a recorder in tests. */
export interface PathSink {
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
}

/**
 * Moves every particle one frame along the flow and adds its trail segment to `path`. A particle is
 * respawned instead when it has lived its lifetime, has left the view, or has no flow under it.
 */
export function advect(
  particles: readonly Particle[],
  flow: ScreenFlow,
  width: number,
  height: number,
  random: Random,
  path: PathSink,
): void {
  const velocity: Velocity = { dx: 0, dy: 0 };
  for (const particle of particles) {
    const { x, y } = particle;
    const inView = x >= 0 && y >= 0 && x < width && y < height;
    if (++particle.age > particle.lifetime || !inView || !flowAt(flow, x, y, velocity)) {
      respawn(particle, width, height, random);
      continue;
    }
    particle.x = x + velocity.dx;
    particle.y = y + velocity.dy;
    path.moveTo(x, y);
    path.lineTo(particle.x, particle.y);
  }
}
