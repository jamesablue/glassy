import { DOCUMENT } from '@angular/common';
import {
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  InjectionToken,
  input,
  untracked,
} from '@angular/core';
import type { GridSpec, VectorField } from '../../domain/models';
import { mapView, MapContext } from '../map-host/map-context';
import { MAP_PANES, PARTICLES_OVER_LAND } from '../map-host/map-panes';
import {
  ParticleSystem,
  type AnimationHost,
  type ParticleField,
} from '../renderers/particle-system';
import { PARTICLE_STYLES, type ParticleMode } from '../renderers/particles';
import { CanvasOverlay } from './canvas-overlay';
import { keepLayerOnMap } from './keep-layer-on-map';

/** The browser APIs the particle animation runs on: the window, unless a test supplies a fake. */
export const ANIMATION_HOST = new InjectionToken<AnimationHost>('ANIMATION_HOST', {
  providedIn: 'root',
  factory: () => window,
});

/**
 * Animated streaks following the wind, wave or swell vectors, in the `particles` pane.
 *
 * The animation stops while the map moves (every particle's screen position goes stale) and starts
 * afresh when it settles. A new hour only changes the vectors under the particles, so they keep
 * flowing instead of starting over.
 */
@Component({ selector: 'glassy-particle-layer', template: '' })
export class ParticleLayerComponent {
  readonly vectors = input<VectorField | undefined>();
  readonly grid = input<GridSpec | undefined>();
  readonly hour = input(0);
  readonly mode = input<ParticleMode>('sea');
  readonly enabled = input(true);

  private readonly field = computed<ParticleField | undefined>(() => {
    const vectors = this.vectors();
    const grid = this.grid();
    if (!vectors || !grid || !this.enabled()) return undefined;
    return { grid, vectors, style: PARTICLE_STYLES[this.mode()] };
  });

  constructor() {
    const context = inject(MapContext);
    const canvas = inject(DOCUMENT).createElement('canvas');
    canvas.className = 'particle-canvas';
    const particles = new ParticleSystem(canvas, inject(ANIMATION_HOST));
    keepLayerOnMap(new CanvasOverlay(canvas, 'particles'));

    effect(() => {
      const map = context.map();
      const field = this.field();
      if (!map || !context.viewport() || context.moving() || !field) {
        particles.stop();
        return;
      }
      particles.start(mapView(map), field, untracked(this.hour));
    });
    effect(() => particles.setHour(this.hour()));
    effect(() => {
      const pane = context.map()?.getPane('particles');
      if (!pane) return;
      pane.style.zIndex = String(
        this.mode() === 'wind' ? PARTICLES_OVER_LAND : MAP_PANES.particles,
      );
    });
    inject(DestroyRef).onDestroy(() => particles.destroy());
  }
}
