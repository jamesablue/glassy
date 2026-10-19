import type * as L from 'leaflet';
import { frameOahu, framePadding, OAHU_BOUNDS } from './frame-oahu';

describe('framePadding', () => {
  it('keeps the top and bottom clear on phones', () => {
    expect(framePadding(400)).toEqual({ topLeft: [10, 60], bottomRight: [50, 130] });
    expect(framePadding(759)).toEqual({ topLeft: [10, 60], bottomRight: [50, 130] });
  });

  it('keeps the side panel and layer menu clear on tablets', () => {
    expect(framePadding(760)).toEqual({ topLeft: [250, 30], bottomRight: [120, 80] });
    expect(framePadding(1000)).toEqual({ topLeft: [250, 30], bottomRight: [120, 80] });
  });

  it('gives the panels more room on wide screens', () => {
    expect(framePadding(1001)).toEqual({ topLeft: [350, 30], bottomRight: [170, 80] });
  });
});

describe('frameOahu', () => {
  /** The parts of a Leaflet map framing uses, with a size the test controls. */
  function fakeMap(width: number, height: number) {
    const listeners = new Map<string, () => void>();
    const map = {
      size: { x: width, y: height },
      getSize: () => map.size,
      setView: vi.fn(),
      fitBounds: vi.fn(),
      on: vi.fn((type: string, listener: () => void) => listeners.set(type, listener)),
      off: vi.fn((type: string) => listeners.delete(type)),
      resize: (x: number, y: number) => {
        map.size = { x, y };
        listeners.get('resize')?.();
      },
      listening: () => listeners.size > 0,
    };
    return map;
  }

  it('fits Oahu into the space the panels leave', () => {
    const map = fakeMap(1280, 800);
    frameOahu(map as unknown as L.Map);
    expect(map.fitBounds).toHaveBeenCalledWith(OAHU_BOUNDS, {
      paddingTopLeft: [350, 30],
      paddingBottomRight: [170, 80],
      animate: false,
    });
    expect(map.listening()).toBe(false);
  });

  it('waits for a real size when the map starts without one', () => {
    const map = fakeMap(0, 0);
    frameOahu(map as unknown as L.Map);
    expect(map.setView).toHaveBeenCalledWith(OAHU_BOUNDS.getCenter(), 10);
    expect(map.fitBounds).not.toHaveBeenCalled();

    map.resize(800, 0);
    expect(map.fitBounds).not.toHaveBeenCalled();

    map.resize(400, 700);
    expect(map.fitBounds).toHaveBeenCalledWith(OAHU_BOUNDS, {
      paddingTopLeft: [10, 60],
      paddingBottomRight: [50, 130],
      animate: false,
    });
    expect(map.listening()).toBe(false);
  });
});
