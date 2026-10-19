import { offshorePoint } from '../geo/offshore-point';
import { gridPosition } from '../grid/grid-position';
import { OAHU_GRID } from '../grid/oahu-grid';
import { REGIONS } from '../models';
import { OAHU_SPOTS } from './oahu.spots';

describe('OAHU_SPOTS', () => {
  it('lists 25 spots with unique, URL-safe ids', () => {
    const ids = OAHU_SPOTS.map((spot) => spot.id);
    expect(ids).toHaveLength(25);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z]+$/);
  });

  it('groups spots by region, clockwise from the North Shore', () => {
    const regionOrder = [...new Set(OAHU_SPOTS.map((spot) => spot.region))];
    expect(regionOrder).toEqual([...REGIONS]);
  });

  it('describes each coastline with values the scoring model can use', () => {
    for (const spot of OAHU_SPOTS) {
      expect(spot.facing).toBeGreaterThanOrEqual(0);
      expect(spot.facing).toBeLessThan(360);
      expect(spot.window).toBeGreaterThan(0);
      expect(spot.window).toBeLessThanOrEqual(90);
      expect(spot.shelter).toBeGreaterThanOrEqual(0);
      expect(spot.shelter).toBeLessThanOrEqual(1);
      expect(spot.notes.length).toBeGreaterThan(20);
    }
  });

  it('places every spot and its offshore sample point on the forecast grid', () => {
    for (const spot of OAHU_SPOTS) {
      expect(gridPosition(OAHU_GRID, spot.lat, spot.lon).outside).toBe(0);
      const offshore = offshorePoint(spot);
      expect(gridPosition(OAHU_GRID, offshore.lat, offshore.lon).outside).toBe(0);
    }
  });

  it('keeps Hawaiian spelling', () => {
    const names = OAHU_SPOTS.map((spot) => spot.name);
    expect(names).toContain('Kāneʻohe Sandbar');
    expect(names).toContain('Pōkaʻi Bay');
  });
});
