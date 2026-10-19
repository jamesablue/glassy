import { TestBed } from '@angular/core/testing';
import { provideGlassyConfig } from '../../core/glassy-config.token';
import { TERRAIN_TILE_SOURCES, type TerrainTileSources } from '../../core/terrain-tile-sources';
import { exportImageTileUrl } from './export-image';
import { provideNoaaTileSources } from './noaa-terrain-tile-sources';
import { DEPTH_RULE, LAND_RULE } from './raster-functions';

describe('provideNoaaTileSources', () => {
  const baseUrl = 'https://example.com/ImageServer';
  const tile = { x: 63, y: 450, z: 10 };
  let sources: TerrainTileSources;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideGlassyConfig({ noaaDemUrl: baseUrl }), provideNoaaTileSources()],
    });
    sources = TestBed.inject(TERRAIN_TILE_SOURCES);
  });

  it('renders land tiles with the hillshade rule on the configured ImageServer', () => {
    expect(sources.landTileUrl(tile, 1)).toBe(exportImageTileUrl(tile, LAND_RULE, 256, baseUrl));
  });

  it('renders depth tiles with the depth class rule', () => {
    expect(sources.depthTileUrl(tile, 1)).toBe(exportImageTileUrl(tile, DEPTH_RULE, 256, baseUrl));
  });

  it('asks for double-size images on high-density screens', () => {
    const size = (url: string): string | null => new URL(url).searchParams.get('size');
    expect(size(sources.landTileUrl(tile, 2))).toBe('512,512');
    expect(size(sources.depthTileUrl(tile, 2))).toBe('512,512');
    expect(size(sources.depthTileUrl(tile, 1.25))).toBe('256,256');
  });
});

describe('TERRAIN_TILE_SOURCES', () => {
  it('has no implicit default', () => {
    expect(() => TestBed.inject(TERRAIN_TILE_SOURCES)).toThrow(/TERRAIN_TILE_SOURCES/);
  });
});
