import type { Spot } from '../models';
import { angularDifference } from './angles';

/** Swell window half-width (degrees) for spots that do not set their own. */
export const DEFAULT_SWELL_WINDOW = 80;

/** Share of a wave train that still wraps in at the very edge of the swell window. */
const WINDOW_EDGE_EXPOSURE = 0.25;

/** Beyond the window, refraction keeps feeding some energy in over this many degrees. */
const WRAP_ZONE = 45;

/**
 * Fraction (0–1) of a wave train that reaches a spot, given the direction it comes from.
 *
 * Head-on swell arrives in full. Inside the swell window the share tapers along a cosine curve to
 * 25% at the window's edge, then fades linearly to nothing across a 45° wrap zone, where only
 * refracted energy bends around the coast. Swell from behind the coast never arrives.
 */
export function exposure(direction: number, spot: Spot): number {
  const offAxis = angularDifference(direction, spot.facing);
  const halfWidth = spot.window ?? DEFAULT_SWELL_WINDOW;
  if (offAxis <= halfWidth) {
    return (
      WINDOW_EDGE_EXPOSURE +
      (1 - WINDOW_EDGE_EXPOSURE) * Math.cos(((offAxis / halfWidth) * Math.PI) / 2)
    );
  }
  if (offAxis <= halfWidth + WRAP_ZONE) {
    return WINDOW_EDGE_EXPOSURE * (1 - (offAxis - halfWidth) / WRAP_ZONE);
  }
  return 0;
}
