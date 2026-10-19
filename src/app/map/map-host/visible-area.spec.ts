import * as L from 'leaflet';
import { centreShowing, shrinkArea, visibleArea } from './visible-area';

describe('visibleArea', () => {
  it('is what the panels leave of the map', () => {
    const area = visibleArea(L.point(1280, 800), { top: 12, right: 160, bottom: 90, left: 344 });
    expect(area.getTopLeft()).toEqual(L.point(344, 12));
    expect(area.getBottomRight()).toEqual(L.point(1120, 710));
  });

  it('is the whole map when the panels would cover all of it', () => {
    const size = L.point(390, 300);
    const area = visibleArea(size, { top: 56, right: 52, bottom: 250, left: 8 });
    expect(area.getTopLeft()).toEqual(L.point(0, 0));
    expect(area.getBottomRight()).toEqual(size);
  });
});

describe('shrinkArea', () => {
  it('takes a share of the size off every side', () => {
    const area = shrinkArea(L.bounds([100, 0], [300, 100]), 0.2);
    expect(area.getTopLeft()).toEqual(L.point(140, 20));
    expect(area.getBottomRight()).toEqual(L.point(260, 80));
  });
});

describe('centreShowing', () => {
  let map: L.Map;

  beforeEach(() => {
    const container = document.createElement('div');
    Object.defineProperty(container, 'clientWidth', { value: 1000 });
    Object.defineProperty(container, 'clientHeight', { value: 600 });
    document.body.append(container);
    map = L.map(container).setView([21.4, -157.9], 10);
  });

  afterEach(() => {
    const container = map.getContainer();
    map.remove();
    container.remove();
  });

  it('is the target itself for the middle of the map', () => {
    const target = L.latLng(21.3, -157.7);
    const centre = centreShowing(map, target, 12, L.point(500, 300));
    expect(centre.lat).toBeCloseTo(target.lat, 9);
    expect(centre.lng).toBeCloseTo(target.lng, 9);
  });

  it('puts the target at another point once the map is centred there', () => {
    const target = L.latLng(21.3, -157.7);
    const centre = centreShowing(map, target, 12, L.point(700, 200));
    map.setView(centre, 12, { animate: false });
    const landed = map.latLngToContainerPoint(target);
    expect(landed.x).toBeCloseTo(700, 6);
    expect(landed.y).toBeCloseTo(200, 6);
  });
});
