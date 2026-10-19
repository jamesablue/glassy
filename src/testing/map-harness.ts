import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import type * as L from 'leaflet';
import type { TerrainTileSources, TileCoords } from '../app/core/terrain-tile-sources';
import { MapContext } from '../app/map/map-host/map-context';
import { MapHostComponent } from '../app/map/map-host/map-host.component';

/** Tile sources that return readable fake URLs, so tests can see which tiles were asked for. */
export const FAKE_TILE_SOURCES: TerrainTileSources = {
  landTileUrl: ({ x, y, z }: TileCoords, ratio: number) => `land:${z}/${x}/${y}@${ratio}`,
  depthTileUrl: ({ x, y, z }: TileCoords, ratio: number) => `depth:${z}/${x}/${y}@${ratio}`,
};

/** The {@link MapContext} of the first map host in a fixture. */
export function mapContextOf(fixture: ComponentFixture<unknown>): MapContext {
  return fixture.debugElement.query(By.directive(MapHostComponent)).injector.get(MapContext);
}

/** The Leaflet map of the first map host in a fixture, once it has rendered. */
export function leafletMapOf(fixture: ComponentFixture<unknown>): L.Map {
  const map = mapContextOf(fixture).map();
  if (!map) throw new Error('The map has not been created yet');
  return map;
}

/** Renders the fixture until the map host has created its map and the layers have caught up. */
export async function renderMap(fixture: ComponentFixture<unknown>): Promise<L.Map> {
  fixture.detectChanges();
  await fixture.whenStable();
  TestBed.tick();
  return leafletMapOf(fixture);
}

/**
 * Gives the map's container a size (jsdom lays nothing out) and tells Leaflet about it, which
 * frames Oahu and lets the layers draw for a real viewport.
 */
export function resizeMap(fixture: ComponentFixture<unknown>, width = 600, height = 400): L.Map {
  const map = leafletMapOf(fixture);
  const container = map.getContainer();
  Object.defineProperty(container, 'clientWidth', { configurable: true, value: width });
  Object.defineProperty(container, 'clientHeight', { configurable: true, value: height });
  map.invalidateSize();
  TestBed.tick();
  return map;
}
