import { TestBed } from '@angular/core/testing';
import * as L from 'leaflet';
import { mapView, MapContext } from './map-context';

describe('MapContext', () => {
  let container: HTMLElement;
  let map: L.Map;
  let context: MapContext;

  beforeEach(() => {
    container = document.createElement('div');
    Object.defineProperty(container, 'clientWidth', { value: 300 });
    Object.defineProperty(container, 'clientHeight', { value: 200 });
    document.body.append(container);
    map = L.map(container).setView([21.5, -158], 10);
    TestBed.configureTestingModule({ providers: [MapContext] });
    context = TestBed.inject(MapContext);
  });

  afterEach(() => {
    map.remove();
    container.remove();
  });

  it('has no map until one is connected', () => {
    expect(context.map()).toBeUndefined();
    expect(context.viewport()).toBeUndefined();
  });

  it('shares the map and its viewport once connected', () => {
    context.connect(map);
    expect(context.map()).toBe(map);
    expect(context.viewport()).toEqual({ zoom: 10, width: 300, height: 200 });
  });

  it('reports moves and zooms until the map settles', () => {
    context.connect(map);
    map.fire('movestart');
    expect([context.moving(), context.zooming()]).toEqual([true, false]);
    map.fire('zoomstart');
    expect([context.moving(), context.zooming()]).toEqual([true, true]);
    map.fire('moveend');
    expect([context.moving(), context.zooming()]).toEqual([false, false]);
  });

  it('measures the view again after every move and resize', () => {
    context.connect(map);
    const first = context.viewport();
    map.fire('moveend');
    const second = context.viewport();
    map.fire('resize');
    expect(second).not.toBe(first);
    expect(context.viewport()).not.toBe(second);
  });

  it('stops listening and forgets the map when disconnected', () => {
    const disconnect = context.connect(map);
    disconnect();
    map.fire('movestart');
    expect(context.map()).toBeUndefined();
    expect(context.viewport()).toBeUndefined();
    expect(context.moving()).toBe(false);
  });
});

describe('mapView', () => {
  it('describes the view in plain numbers and coordinates', () => {
    const container = document.createElement('div');
    Object.defineProperty(container, 'clientWidth', { value: 256 });
    Object.defineProperty(container, 'clientHeight', { value: 256 });
    const map = L.map(container).setView([0, 0], 0);

    const view = mapView(map);
    expect([view.width, view.height]).toEqual([256, 256]);
    expect(view.origin).toEqual({ x: 0, y: 0 });
    // At zoom 0 the 256 px world is centred on 0°, 0°.
    expect(view.toLatLon(128, 128)).toEqual({ lat: 0, lon: 0 });
    expect(view.toLatLon(0, 128).lon).toBeCloseTo(-180, 6);
    map.remove();
  });
});
