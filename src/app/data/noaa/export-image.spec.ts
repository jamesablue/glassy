import { exportImageTileUrl, tileBbox, tilePixelSize } from './export-image';
import { DEPTH_RULE } from './raster-functions';

const HALF_WORLD = 20037508.342789244;

describe('tileBbox', () => {
  it('covers the whole Web Mercator world at zoom 0', () => {
    expect(tileBbox({ x: 0, y: 0, z: 0 })).toEqual([
      -HALF_WORLD,
      -HALF_WORLD,
      HALF_WORLD,
      HALF_WORLD,
    ]);
  });

  it('counts rows from the top', () => {
    expect(tileBbox({ x: 0, y: 0, z: 1 })).toEqual([-HALF_WORLD, 0, 0, HALF_WORLD]);
    expect(tileBbox({ x: 1, y: 1, z: 1 })).toEqual([0, -HALF_WORLD, HALF_WORLD, 0]);
    expect(tileBbox({ x: 1, y: 2, z: 2 })).toEqual([-HALF_WORLD / 2, -HALF_WORLD / 2, 0, 0]);
  });

  it('finds the zoom-10 tile over Hanauma Bay', () => {
    // 157.69°W 21.27°N is tile 63/450 at zoom 10.
    const [xmin, ymin, xmax, ymax] = tileBbox({ x: 63, y: 450, z: 10 });
    const lonToX = (lon: number): number => (lon / 180) * HALF_WORLD;
    const latToY = (lat: number): number =>
      (Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) / Math.PI) * HALF_WORLD;
    expect(xmin).toBeLessThan(lonToX(-157.69));
    expect(xmax).toBeGreaterThan(lonToX(-157.69));
    expect(ymin).toBeLessThan(latToY(21.27));
    expect(ymax).toBeGreaterThan(latToY(21.27));
    expect(xmax - xmin).toBeCloseTo((2 * HALF_WORLD) / 1024, 6);
  });
});

describe('tilePixelSize', () => {
  it('doubles the image size on high-density screens', () => {
    expect(tilePixelSize(1)).toBe(256);
    expect(tilePixelSize(1.4)).toBe(256);
    expect(tilePixelSize(2)).toBe(512);
  });
});

describe('exportImageTileUrl', () => {
  const base = 'https://example.com/ImageServer';
  const url = exportImageTileUrl({ x: 1, y: 0, z: 1 }, DEPTH_RULE, 512, base);
  const params = new URL(url).searchParams;

  it('asks the ImageServer to render the tile bbox in Web Mercator', () => {
    expect(url.startsWith(`${base}/exportImage?bbox=0,0,${HALF_WORLD},${HALF_WORLD}&`)).toBe(true);
    expect(params.get('bboxSR')).toBe('3857');
    expect(params.get('imageSR')).toBe('3857');
    expect(params.get('size')).toBe('512,512');
  });

  it('asks for a transparent, smoothly interpolated PNG', () => {
    expect(params.get('format')).toBe('png32');
    expect(params.get('transparent')).toBe('true');
    expect(params.get('interpolation')).toBe('RSP_BilinearInterpolation');
    expect(params.get('f')).toBe('image');
  });

  it('sends the raster function as the rendering rule', () => {
    expect(JSON.parse(params.get('renderingRule') ?? '')).toEqual(DEPTH_RULE);
    expect(url).toContain('renderingRule=%7B%22rasterFunction%22%3A%22Colormap%22');
  });
});
