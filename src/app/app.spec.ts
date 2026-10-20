import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import * as L from 'leaflet';
import { of } from 'rxjs';
import { FakeAnimationHost } from '../testing/fake-animation-host';
import { installFakeCanvas } from '../testing/fake-canvas';
import { recordedForecastBundle } from '../testing/forecast-bundle';
import { FAKE_TILE_SOURCES, leafletMapOf, renderMap, resizeMap } from '../testing/map-harness';
import {
  provideFakeBathymetry,
  provideTestForecast,
  ScriptedForecastRepository,
} from '../testing/state-providers';
import { App } from './app';
import { TERRAIN_TILE_SOURCES } from './core/terrain-tile-sources';
import { ForecastRepository } from './data/forecast.repository';
import { OAHU_SPOTS } from './domain/spots';
import { ANIMATION_HOST } from './map';
import { MapUiStore } from './state';

describe('App', () => {
  /** 8:30 AM on the recorded forecast's first day in Honolulu. */
  const MORNING = Date.UTC(2026, 9, 18, 18, 30);
  let canvases: ReturnType<typeof installFakeCanvas>;
  let animation: FakeAnimationHost;

  beforeEach(() => {
    localStorage.clear();
    canvases = installFakeCanvas();
    animation = new FakeAnimationHost();
    TestBed.configureTestingModule({
      imports: [App],
      providers: [
        ...provideTestForecast(recordedForecastBundle(), MORNING),
        provideFakeBathymetry(() => of(-3)),
        { provide: TERRAIN_TILE_SOURCES, useValue: FAKE_TILE_SOURCES },
        { provide: ANIMATION_HOST, useValue: animation },
      ],
    });
  });

  afterEach(() => canvases.restore());

  async function setup(): Promise<{ fixture: ComponentFixture<App>; element: HTMLElement }> {
    const fixture = TestBed.createComponent(App);
    await renderMap(fixture);
    resizeMap(fixture, 1280, 800);
    await fixture.whenStable();
    return { fixture, element: fixture.nativeElement as HTMLElement };
  }

  const pins = (element: HTMLElement): NodeListOf<HTMLButtonElement> =>
    element.querySelectorAll('glassy-spot-pin button');

  it('floats the feature shell over the map, ahead of it in the page', async () => {
    const { element } = await setup();
    expect(element.querySelector('glassy-app-shell + glassy-map')).not.toBeNull();
    expect(element.querySelector('h1')?.textContent).toBe('Glassy');
    expect(element.querySelector('.tagline')?.textContent).toBe('Oahu snorkel forecast');
    expect(element.querySelectorAll('glassy-spot-ranking-row')).toHaveLength(OAHU_SPOTS.length);
  });

  it('highlights a spot’s pin and row together', async () => {
    const { fixture, element } = await setup();
    const kuilimaRow = Array.from(element.querySelectorAll('glassy-spot-ranking-row .row')).find(
      (row) => row.querySelector('.name')?.textContent === 'Kuilima Cove (Turtle Bay)',
    );
    kuilimaRow?.dispatchEvent(new MouseEvent('mouseenter'));
    await fixture.whenStable();
    const hovered = Array.from(element.querySelectorAll('glassy-spot-pin .pin.hovered'));
    expect(hovered.map((pin) => pin.getAttribute('aria-label'))).toEqual([
      expect.stringMatching(/^Kuilima Cove/),
    ]);

    kuilimaRow?.dispatchEvent(new MouseEvent('mouseleave'));
    pins(element)[0]?.dispatchEvent(new MouseEvent('mouseenter'));
    await fixture.whenStable();
    expect(TestBed.inject(MapUiStore).hoveredSpotId()).toBe(OAHU_SPOTS[0]?.id);
    expect(element.querySelectorAll('glassy-spot-ranking-row .row.hovered')).toHaveLength(1);
  });

  it('draws the active layer with its particles and a pin for every spot', async () => {
    const { element } = await setup();
    expect(element.querySelector('.leaflet-field-pane .field-canvas')).not.toBeNull();
    expect(animation.pendingFrames).toBe(1);
    expect(pins(element)).toHaveLength(OAHU_SPOTS.length);
  });

  it('inspects the point the map was clicked at', async () => {
    const { fixture, element } = await setup();
    leafletMapOf(fixture).fire('click', { latlng: L.latLng(21.1, -157.9) });
    await fixture.whenStable();
    expect(TestBed.inject(MapUiStore).inspectedPoint()).toEqual({ lat: 21.1, lon: -157.9 });
    expect(element.querySelector('.leaflet-popup.picker')).not.toBeNull();
  });

  it('selects the spot whose pin was clicked', async () => {
    const { element } = await setup();
    const hanauma = Array.from(pins(element)).find((pin) =>
      pin.getAttribute('aria-label')?.startsWith('Hanauma Bay'),
    );
    hanauma?.click();
    expect(TestBed.inject(MapUiStore).selectedSpotId()).toBe('hanauma');
  });

  it('swaps the forecast colours for depth tiles on the depth layer', async () => {
    const { fixture, element } = await setup();
    TestBed.inject(MapUiStore).setLayer('depth');
    await fixture.whenStable();
    const map = leafletMapOf(fixture);
    expect(map.getPane('depth')?.querySelector('.leaflet-tile-container')).not.toBeNull();
    expect(element.querySelector<HTMLElement>('.field-canvas')?.style.display).toBe('none');
    expect(animation.pendingFrames).toBe(0);
  });

  it('hides the pins when spots are turned off', async () => {
    const { fixture, element } = await setup();
    TestBed.inject(MapUiStore).toggleSpots();
    await fixture.whenStable();
    expect(pins(element)).toHaveLength(0);
  });

  it('pins the spots before the map grid lands, and draws the layer once it does', async () => {
    const repository = new ScriptedForecastRepository();
    TestBed.overrideProvider(ForecastRepository, { useValue: repository });
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    TestBed.tick();
    // The app is not stable until the first result arrives.
    repository.serveSpots(recordedForecastBundle(), MORNING);
    await renderMap(fixture);
    resizeMap(fixture, 1280, 800);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const field = (): HTMLElement | null => element.querySelector('.field-canvas');

    expect(pins(element)).toHaveLength(OAHU_SPOTS.length);
    expect(field()?.style.display).toBe('none');
    expect(animation.pendingFrames).toBe(0);
    expect(element.querySelector('glassy-map-layers-chip')).not.toBeNull();

    repository.succeed(recordedForecastBundle(), MORNING);
    await fixture.whenStable();
    expect(field()?.style.display).toBe('');
    expect(animation.pendingFrames).toBe(1);
    expect(element.querySelector('glassy-map-layers-chip')).toBeNull();
  });

  it('leaves no map, layer, listener or animation frame behind when destroyed', async () => {
    const { fixture } = await setup();
    const map = leafletMapOf(fixture);
    const container = map.getContainer();
    TestBed.inject(MapUiStore).inspect({ lat: 21.1, lon: -157.9 });
    await fixture.whenStable();

    fixture.destroy();
    expect(container.querySelector('.leaflet-pane')).toBeNull();
    expect(document.querySelector('.leaflet-popup, glassy-spot-pin, canvas')).toBeNull();
    expect(animation.pendingFrames).toBe(0);
    expect(animation.reducedMotion.listenerCount).toBe(0);
    expect(animation.document.listenerCount).toBe(0);
  });
});
