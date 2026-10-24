import type { Spot } from './spots';

/**
 * A short hash of what a snapshot's per-spot series depend on: each spot's id and position, and
 * the way it faces (which sets where its marine values are read), in catalog order. A snapshot made
 * for a different catalog, or the same spots in another order, has a different fingerprint, so the
 * app can refuse to line its series up with the wrong spots.
 *
 * 32-bit FNV-1a in plain JavaScript, so it runs the same in the browser and in Node. It guards
 * against mistakes, not tampering.
 */
export function catalogFingerprint(spots: readonly Spot[]): string {
  const text = spots.map((spot) => `${spot.id}:${spot.lat}:${spot.lon}:${spot.facing}`).join(';');
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
