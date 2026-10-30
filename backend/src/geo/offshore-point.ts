import type { LatLon, Spot } from '@glassy/shared';

const KM_PER_DEGREE_LATITUDE = 111.32;

/** How far offshore marine values are sampled by default, km. */
export const OFFSHORE_DISTANCE_KM = 6;

/**
 * The point `km` kilometres out to sea in the direction a spot faces. Wave models mask coastal
 * cells as land, so marine values for a spot are read here, in open water in front of it.
 * Uses a flat-earth approximation, which is accurate to metres over a few kilometres.
 */
export function offshorePoint(spot: Spot, km = OFFSHORE_DISTANCE_KM): LatLon {
  const bearing = (spot.facing * Math.PI) / 180;
  const kmPerDegreeLongitude = KM_PER_DEGREE_LATITUDE * Math.cos((spot.lat * Math.PI) / 180);
  return {
    lat: spot.lat + (km / KM_PER_DEGREE_LATITUDE) * Math.cos(bearing),
    lon: spot.lon + (km / kmPerDegreeLongitude) * Math.sin(bearing),
  };
}

/**
 * Where marine values are read for a spot: its own `sample` point when the catalog sets one, else
 * the point `km` out along its facing ({@link offshorePoint}).
 */
export function samplingPoint(spot: Spot, km = OFFSHORE_DISTANCE_KM): LatLon {
  return spot.sample ?? offshorePoint(spot, km);
}
