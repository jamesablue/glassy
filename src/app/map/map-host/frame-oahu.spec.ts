import type * as L from 'leaflet';
import { frameOahu, framePadding, OAHU_BOUNDS, panelInsets } from './frame-oahu';

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

describe('panelInsets', () => {
  it('keeps clear of the side panel, the menu and the timeline on wider screens', () => {
    const insets = { top: 12, right: 160, bottom: 90, left: 344 };
    expect(panelInsets(760, 600, false)).toEqual(insets);
    expect(panelInsets(1600, 900, true)).toEqual(insets);
  });

  it('keeps clear of the sheet above the timeline on a phone, more when it is open', () => {
    expect(panelInsets(390, 800, false)).toEqual({ top: 56, right: 52, bottom: 156, left: 8 });
    expect(panelInsets(390, 800, true)).toEqual({ top: 56, right: 52, bottom: 464, left: 8 });
  });
});
