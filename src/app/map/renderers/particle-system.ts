import type { GridSpec, VectorField } from '../../domain/models';
import { placeCanvas, type MapView } from './map-view';
import {
  advect,
  MAX_CELLS_OUTSIDE,
  particleCount,
  respawn,
  type ParticleStyle,
  type Random,
  type ScreenFlow,
} from './particles';
import { buildViewportLookup, maskOutside } from './viewport-lookup';

/** Sharper than 2× costs four times the pixels per frame for trails nobody can tell apart. */
export const MAX_PIXEL_RATIO = 2;

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

/** Something that announces changes: the page's visibility or a media query. */
interface ChangeSource {
  addEventListener(type: string, listener: () => void): void;
  removeEventListener(type: string, listener: () => void): void;
}

/** The browser APIs the animation uses. `window` provides them; tests pass a fake. */
export interface AnimationHost {
  readonly document: ChangeSource & { readonly hidden: boolean };
  readonly devicePixelRatio: number;
  requestAnimationFrame(callback: FrameRequestCallback): number;
  cancelAnimationFrame(handle: number): void;
  matchMedia(query: string): ChangeSource & { readonly matches: boolean };
}

/** What the particles follow. */
export interface ParticleField {
  readonly grid: GridSpec;
  readonly vectors: VectorField;
  readonly style: ParticleStyle;
}

interface Animation {
  readonly view: MapView;
  readonly field: ParticleField;
}

/**
 * Particles streaming along a vector field, drawn as fading trails on a canvas covering the view.
 *
 * Each frame keeps a share of the previous frame (`style.fade`) and adds one short segment per
 * particle, which turns motion into trails without storing any history. The animation runs on
 * `requestAnimationFrame`, pauses while the page is hidden and never runs when the user prefers
 * reduced motion. Moving the map invalidates every particle's screen position, so the caller stops
 * it when a move starts and starts it again when the move ends.
 */
export class ParticleSystem {
  private readonly context: CanvasRenderingContext2D | null;
  private readonly reducedMotion: ChangeSource & { readonly matches: boolean };
  private animation: Animation | undefined;
  private flow: ScreenFlow | undefined;
  private hour = 0;
  private frame = 0;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly host: AnimationHost,
    private readonly random: Random = Math.random,
  ) {
    this.context = canvas.getContext('2d');
    this.reducedMotion = host.matchMedia(REDUCED_MOTION);
    this.reducedMotion.addEventListener('change', this.restart);
    host.document.addEventListener('visibilitychange', this.restart);
  }

  /** Whether a frame is scheduled. */
  get running(): boolean {
    return this.frame !== 0;
  }

  /** Starts (or restarts) the animation over `view`, with every particle placed afresh. */
  start(view: MapView, field: ParticleField, hour: number): void {
    this.animation = { view, field };
    this.hour = hour;
    this.restart();
  }

  /** Follows the field at another hour without restarting, so the trails flow on. */
  setHour(hour: number): void {
    this.hour = hour;
    if (this.flow) this.flow.hour = hour;
  }

  /** Stops the animation and clears the canvas until the next `start`. */
  stop(): void {
    this.animation = undefined;
    this.pause();
  }

  /** Stops for good and lets go of the page listeners. */
  destroy(): void {
    this.stop();
    this.reducedMotion.removeEventListener('change', this.restart);
    this.host.document.removeEventListener('visibilitychange', this.restart);
  }

  private pause(): void {
    this.host.cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.flow = undefined;
    this.context?.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  /** Pauses, then starts afresh if there is something to animate and animating is allowed. */
  private readonly restart = (): void => {
    this.pause();
    const { animation, context } = this;
    if (!animation || !context || this.host.document.hidden || this.reducedMotion.matches) return;
    const { view, field } = animation;
    const { width, height } = view;
    if (!width || !height) return;

    const ratio = Math.min(MAX_PIXEL_RATIO, this.host.devicePixelRatio || 1);
    this.canvas.width = Math.round(width * ratio);
    this.canvas.height = Math.round(height * ratio);
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    placeCanvas(this.canvas, view.origin);
    // Draw in CSS pixels; the transform maps them onto the denser canvas, line widths included.
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.lineWidth = field.style.lineWidth;
    context.strokeStyle = field.style.color;

    const lookup = buildViewportLookup(field.grid, view.toLatLon, {
      width,
      height,
      scale: 1,
      offset: 0,
    });
    const flow: ScreenFlow = {
      grid: field.grid,
      vectors: field.vectors,
      hour: this.hour,
      rows: maskOutside(lookup.rows, lookup.rowsOutside, MAX_CELLS_OUTSIDE),
      cols: maskOutside(lookup.cols, lookup.colsOutside, MAX_CELLS_OUTSIDE),
      speed: field.style.speed,
    };
    const particles = Array.from({ length: particleCount(width, height, field.style) }, () =>
      respawn({ x: 0, y: 0, age: 0, lifetime: 0 }, width, height, this.random, true),
    );
    const fade = `rgba(0,0,0,${field.style.fade})`;

    const tick = (): void => {
      // Keep `fade` of what is already drawn, so older segments dim a little every frame.
      context.globalCompositeOperation = 'destination-in';
      context.fillStyle = fade;
      context.fillRect(0, 0, width, height);
      context.globalCompositeOperation = 'source-over';
      context.beginPath();
      advect(particles, flow, width, height, this.random, context);
      context.stroke();
      this.frame = this.host.requestAnimationFrame(tick);
    };
    this.flow = flow;
    this.frame = this.host.requestAnimationFrame(tick);
  };
}
