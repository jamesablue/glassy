import { Component, inject, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import * as L from 'leaflet';
import { mapContextOf, renderMap, resizeMap } from '../../../testing/map-harness';
import { PREFERS_REDUCED_MOTION } from '../../core/reduced-motion';
import type { LatLon } from '../../domain/models';
import { MapContext } from './map-context';
import { MapHostComponent } from './map-host.component';
import { MAP_PANES } from './map-panes';

/** A projected child that only looks at the context it was given. */
@Component({ selector: 'glassy-context-probe', template: '' })
class ContextProbeComponent {
  readonly context = inject(MapContext);
}

@Component({
  imports: [MapHostComponent, ContextProbeComponent],
  template: `
    @if (shown()) {
      <glassy-map (mapClick)="clicks.push($event)">
        <glassy-context-probe />
      </glassy-map>
    }
  `,
})
class HostComponent {
  readonly shown = signal(true);
  readonly clicks: LatLon[] = [];
}

describe('MapHostComponent', () => {
  async function setup() {
    const fixture = TestBed.createComponent(HostComponent);
    const map = await renderMap(fixture);
    return { fixture, map, element: fixture.nativeElement as HTMLElement };
  }

  it('creates a Leaflet map with the custom panes in their stacking order', async () => {
    const { map } = await setup();
    for (const [name, zIndex] of Object.entries(MAP_PANES)) {
      expect(map.getPane(name)?.style.zIndex).toBe(String(zIndex));
    }
  });

  it('keeps zoom levels and panning to the islands', async () => {
    const { map } = await setup();
    expect([map.getMinZoom(), map.getMaxZoom()]).toEqual([7, 15]);
    expect(map.options.zoomSnap).toBe(0.25);
    expect(map.options.maxBounds).toBeDefined();
  });

  it('puts the zoom buttons bottom right and the credits bottom left', async () => {
    const { element } = await setup();
    expect(
      element.querySelector('.leaflet-bottom.leaflet-right .leaflet-control-zoom'),
    ).not.toBeNull();
    const credits = element.querySelector(
      '.leaflet-bottom.leaflet-left .leaflet-control-attribution',
    );
    expect(credits?.textContent).toContain('Leaflet');
    expect(credits?.textContent).toContain('Open-Meteo');
    expect(credits?.textContent).toContain('NOAA NCEI');
  });

  it('shares the map with the layers projected into it', async () => {
    const { fixture, map } = await setup();
    const probe = fixture.debugElement.query((node) => node.name === 'glassy-context-probe');
    const context = probe.componentInstance as ContextProbeComponent;
    expect(context.context).toBe(mapContextOf(fixture));
    expect(context.context.map()).toBe(map);
  });

  it('frames Oahu once the map has a size', async () => {
    const { fixture, map } = await setup();
    // jsdom lays nothing out, so the map starts with no size and a rough view.
    expect(map.getZoom()).toBe(10);
    resizeMap(fixture, 1280, 800);
    expect(map.getBounds().contains(L.latLng(21.5, -158))).toBe(true);
    expect(map.getZoom()).toBeGreaterThan(9);
  });

  describe('for keyboard and screen reader users', () => {
    const press = (target: HTMLElement, key: string): KeyboardEvent => {
      const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
      target.dispatchEvent(event);
      return event;
    };

    it('is the page’s main landmark, named and explained', async () => {
      const { map } = await setup();
      const container = map.getContainer();
      expect(container.getAttribute('role')).toBe('main');
      expect(container.getAttribute('aria-label')).toBe('Forecast map');
      const hint = document.getElementById(container.getAttribute('aria-describedby') ?? '');
      expect(container.contains(hint)).toBe(true);
      expect(hint?.textContent).toContain('Arrow keys pan the map');
      expect(container.tabIndex).toBe(0);
    });

    it('keeps the arrow keys for panning while the map has focus', async () => {
      const { map } = await setup();
      const container = map.getContainer();
      expect(press(container, 'ArrowLeft').defaultPrevented).toBe(true);
      expect(press(container, 'ArrowDown').defaultPrevented).toBe(true);
      expect(press(container, ' ').defaultPrevented).toBe(false);
    });

    it('leaves the keys alone for the controls inside the map', async () => {
      const { map } = await setup();
      const zoomIn = map.getContainer().querySelector<HTMLElement>('.leaflet-control-zoom-in');
      if (!zoomIn) throw new Error('No zoom button');
      expect(press(zoomIn, 'ArrowLeft').defaultPrevented).toBe(false);
    });

    it('inspects the middle of the map on Enter', async () => {
      const { fixture, map } = await setup();
      resizeMap(fixture, 1280, 800);
      press(map.getContainer(), 'Enter');
      const [click] = fixture.componentInstance.clicks;
      expect(click?.lat).toBeCloseTo(map.getCenter().lat, 6);
      expect(click?.lon).toBeCloseTo(map.getCenter().lng, 6);
    });
  });

  describe('motion', () => {
    it('animates zooms and tiles by default', async () => {
      const { map } = await setup();
      expect(map.options).toMatchObject({
        zoomAnimation: true,
        fadeAnimation: true,
        markerZoomAnimation: true,
        inertia: true,
      });
    });

    it('turns Leaflet’s animations off when the user prefers reduced motion', async () => {
      TestBed.configureTestingModule({
        providers: [{ provide: PREFERS_REDUCED_MOTION, useValue: signal(true) }],
      });
      const { map } = await setup();
      expect(map.options).toMatchObject({
        zoomAnimation: false,
        fadeAnimation: false,
        markerZoomAnimation: false,
        inertia: false,
      });
    });
  });

  it('reports clicks on the map as coordinates', async () => {
    const { fixture, map } = await setup();
    map.fire('click', { latlng: L.latLng(21.3, -157.9) });
    expect(fixture.componentInstance.clicks).toEqual([{ lat: 21.3, lon: -157.9 }]);
  });

  it('removes the map and stops sharing it when destroyed', async () => {
    const { fixture, map, element } = await setup();
    const context = mapContextOf(fixture);
    const container = map.getContainer();
    fixture.componentInstance.shown.set(false);
    fixture.detectChanges();

    expect(context.map()).toBeUndefined();
    expect(container.querySelector('.leaflet-pane')).toBeNull();
    expect(element.querySelector('glassy-map')).toBeNull();
  });
});
