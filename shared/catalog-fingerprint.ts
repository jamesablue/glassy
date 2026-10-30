import type { Spot } from './spots';

/**
 * A short hash of what a snapshot's per-spot series depend on: each spot's id and position, and
 * where its marine values are read (its `sample` point), in catalog order. A snapshot made for a
 * different catalog, or the same spots in another order, has a different fingerprint, so the app
 * can refuse to line its series up with the wrong spots.
 *
 * `facing` is hashed only for a spot without a `sample`, since its sampling point then follows
 * `facing`. With `sample` set, `facing` and `window` can be retuned without changing the
 * fingerprint. Format version 2 and later use this; version 1 used {@link catalogFingerprintV1}.
 *
 * 32-bit FNV-1a in plain JavaScript, so it runs the same in the browser and in Node. It guards
 * against mistakes, not tampering.
 */
export function catalogFingerprint(spots: readonly Spot[]): string {
  return fnv1a(
    spots
      .map((spot) => {
        const sample = spot.sample ? `${spot.sample.lat},${spot.sample.lon}` : `f${spot.facing}`;
        return `${spot.id}:${spot.lat}:${spot.lon}:${sample}`;
      })
      .join(';'),
  );
}

/**
 * The fingerprint format version 1 snapshots carry: each spot's id, position and `facing`.
 * Kept so the app still reads a v1 snapshot until every ingest writes version 2.
 */
export function catalogFingerprintV1(spots: readonly Spot[]): string {
  return fnv1a(spots.map((spot) => `${spot.id}:${spot.lat}:${spot.lon}:${spot.facing}`).join(';'));
}

function fnv1a(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
