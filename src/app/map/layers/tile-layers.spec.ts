import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import * as L from 'leaflet';
import { FAKE_TILE_SOURCES, renderMap } from '../../../testing/map-harness';
import { TERRAIN_TILE_SOURCES } from '../../core/terrain-tile-sources';
import { MapHostComponent } from '../map-host/map-host.component';
import { BasemapLayerComponent, ESRI_BASE_URL, ESRI_LABELS_URL } from './basemap-layer.component';
import { DepthLayerComponent } from './depth-layer.component';
import { NoaaExportTileLayer } from './noaa-export-tile-layer';
import { TerrainLayerComponent, type TerrainMode } from './terrain-layer.component';

@Component({
  imports: [MapHostComponent, BasemapLayerComponent, TerrainLayerComponent, DepthLayerComponent],
  template: `
    <glassy-map>
      @if (layersShown()) {
        <glassy-basemap-layer />
        <glassy-terrain-layer [mode]="terrainMode()" />
        <glassy-depth-layer [visible]="depthVisible()" />
      }
    </glassy-map>
  `,
})
class HostComponent {
  readonly layersShown = signal(true);
  readonly terrainMode = signal<TerrainMode>('sea');
  readonly depthVisible = signal(false);
}

/** The tile layers on the map, by their URL template or their kind. */
function tileLayers(map: L.Map): L.TileLayer[] {
  const layers: L.TileLayer[] = [];
  map.eachLayer((layer) => {
    if (layer instanceof L.TileLayer) layers.push(layer);
  });
  return layers;
}

function urlTemplate(layer: L.TileLayer): string {
  return (layer as unknown as { _url: string })._url;
}

describe('tile layers', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: TERRAIN_TILE_SOURCES, useValue: FAKE_TILE_SOURCES }],
    });
  });

  async function setup() {
    const fixture = TestBed.createComponent(HostComponent);
    const map = await renderMap(fixture);
    return { fixture, map, host: fixture.componentInstance };
  }

  const noaa = (map: L.Map, pane: string): NoaaExportTileLayer | undefined =>
    tileLayers(map).find(
      (layer): layer is NoaaExportTileLayer =>
        layer instanceof NoaaExportTileLayer && layer.options.pane === pane,
    );

  describe('BasemapLayerComponent', () => {
    it('draws the Esri dark grey base with its credits', async () => {
      const { map } = await setup();
      const base = tileLayers(map).find((layer) => urlTemplate(layer) === ESRI_BASE_URL);
      expect(base?.options.pane).toBe('tilePane');
      expect(base?.getAttribution?.()).toContain('Esri');
      expect(base?.getAttribution?.()).toContain('OpenStreetMap');
    });

    it('puts the place names in the labels pane', async () => {
      const { map } = await setup();
      const labels = tileLayers(map).find((layer) => urlTemplate(layer) === ESRI_LABELS_URL);
      expect(labels?.options.pane).toBe('labels');
    });
  });

  describe('TerrainLayerComponent', () => {
    it('draws NOAA hillshade tiles in the land pane', async () => {
      const { map } = await setup();
      const land = noaa(map, 'land');
      expect(land?.getTileUrl(Object.assign(L.point(3, 4), { z: 5 }))).toBe('land:5/3/4@1');
    });

    it('styles the land for the active layer', async () => {
      const { fixture, map, host } = await setup();
      const pane = map.getPane('land');
      expect(pane?.classList.contains('mode-sea')).toBe(true);
      expect(pane?.classList.contains('mode-wind')).toBe(false);

      host.terrainMode.set('wind');
      fixture.detectChanges();
      expect(pane?.classList.contains('mode-wind')).toBe(true);
      expect(pane?.classList.contains('mode-sea')).toBe(false);
    });
  });

  describe('DepthLayerComponent', () => {
    it('stays off the map until it is visible', async () => {
      const { fixture, map, host } = await setup();
      expect(noaa(map, 'depth')).toBeUndefined();

      host.depthVisible.set(true);
      fixture.detectChanges();
      const depth = noaa(map, 'depth');
      expect(depth?.getTileUrl(Object.assign(L.point(1, 2), { z: 3 }))).toBe('depth:3/1/2@1');

      host.depthVisible.set(false);
      fixture.detectChanges();
      expect(noaa(map, 'depth')).toBeUndefined();
    });
  });

  it('takes every tile layer off the map when the layers are destroyed', async () => {
    const { fixture, map, host } = await setup();
    host.depthVisible.set(true);
    fixture.detectChanges();
    expect(tileLayers(map)).toHaveLength(4);

    host.layersShown.set(false);
    fixture.detectChanges();
    expect(tileLayers(map)).toEqual([]);
  });
});

describe('NoaaExportTileLayer', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('asks its URL function for each tile with the screen pixel ratio', () => {
    vi.stubGlobal('devicePixelRatio', 2);
    const urlFor = vi.fn(() => 'tile.png');
    const layer = new NoaaExportTileLayer(urlFor);
    expect(layer.getTileUrl(Object.assign(L.point(7, 8), { z: 9 }))).toBe('tile.png');
    expect(urlFor).toHaveBeenCalledWith({ x: 7, y: 8, z: 9 }, 2);
  });

  it('assumes an ordinary screen when the pixel ratio is unknown', () => {
    vi.stubGlobal('devicePixelRatio', 0);
    const urlFor = vi.fn(() => 'tile.png');
    new NoaaExportTileLayer(urlFor).getTileUrl(Object.assign(L.point(0, 0), { z: 0 }));
    expect(urlFor).toHaveBeenCalledWith({ x: 0, y: 0, z: 0 }, 1);
  });

  it('keeps extra tiles around the view because they are slow to render', () => {
    const layer = new NoaaExportTileLayer(() => '', { pane: 'depth' });
    expect(layer.options).toMatchObject({ maxZoom: 15, keepBuffer: 4, pane: 'depth' });
  });
});
