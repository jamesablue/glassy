import type { LatLon, Region, Spot } from '@glassy/shared';
import { offshorePoint } from '../../backend/src/geo/offshore-point';

/**
 * A NOAA wave buoy off Oahu, with the coastline geometry `exposure()` needs to predict it. Every
 * buoy sits partly in the island's shadow, which is what the backtest needs.
 */
export interface Buoy {
  readonly id: string;
  readonly name: string;
  readonly region: Region;
  /** Position from NDBC's station list (activestations.xml). */
  readonly lat: number;
  readonly lon: number;
  /** Middle of the buoy's open-ocean arc, degrees. */
  readonly facing: number;
  /** Half-width of that arc, degrees. */
  readonly window: number;
  /** How the arc was estimated. */
  readonly arc: string;
}

/**
 * Facing and window are estimated by hand from the bearings to the headlands that bound each
 * buoy's view of the open ocean (the other islands are ignored). The report's sensitivity table
 * shows how much the result depends on them.
 */
export const BUOYS: readonly Buoy[] = [
  {
    id: '51212',
    name: 'Barbers Point',
    region: 'West Side',
    lat: 21.323,
    lon: -158.149,
    facing: 220,
    window: 115,
    arc: 'Diamond Head (103°) clockwise to Kaʻena Point (335°)',
  },
  {
    id: '51211',
    name: 'Pearl Harbor',
    region: 'South Shore',
    lat: 21.297,
    lon: -157.959,
    facing: 190,
    window: 80,
    arc: 'Diamond Head (109°) clockwise to Barbers Point (270°)',
  },
  {
    id: '51201',
    name: 'Waimea',
    region: 'North Shore',
    lat: 21.671,
    lon: -158.118,
    facing: 330,
    window: 95,
    arc: 'Kaʻena Point (240°) clockwise to Kahuku Point (70°)',
  },
  {
    id: '51202',
    name: 'Mokapu',
    region: 'Windward',
    lat: 21.414,
    lon: -157.681,
    facing: 60,
    window: 100,
    arc: 'Kahuku Point (318°) clockwise to Makapuʻu Point (165°)',
  },
];

/** How far out along `facing` method B reads the open ocean, km. */
export const UPSTREAM_DISTANCE_KM = 50;

/** How far out the ingest reads marine values today, km (`OFFSHORE_DISTANCE_KM`). */
export const TODAY_DISTANCE_KM = 6;

/** The buoy as a `Spot`, so `exposure()` and `offshorePoint()` can use it unchanged. */
export function asSpot(buoy: Buoy, geometry: Partial<Pick<Spot, 'facing' | 'window'>> = {}): Spot {
  return {
    id: buoy.id,
    name: buoy.name,
    region: buoy.region,
    lat: buoy.lat,
    lon: buoy.lon,
    facing: geometry.facing ?? buoy.facing,
    window: geometry.window ?? buoy.window,
    shelter: 0,
    level: 'Advanced',
    notes: buoy.arc,
  };
}

/** The point `km` kilometers out from the buoy along its facing. */
export function pointOut(buoy: Buoy, km: number): LatLon {
  return offshorePoint(asSpot(buoy), km);
}
