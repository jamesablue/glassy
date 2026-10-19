import { valueAt } from '../math/value-at';
import type { VectorField } from '../models';

/**
 * Splits magnitudes and meteorological directions into east (`u`) and north (`v`) components.
 * Forecasts give the direction wind and waves come *from*; the vectors point the way they travel,
 * which is what the particle animation moves along.
 */
export function toVectorField(
  magnitude: ArrayLike<number>,
  directionFrom: ArrayLike<number>,
): VectorField {
  const u = new Float32Array(magnitude.length);
  const v = new Float32Array(magnitude.length);
  for (let k = 0; k < magnitude.length; k++) {
    const radians = (valueAt(directionFrom, k) * Math.PI) / 180;
    const speed = valueAt(magnitude, k);
    u[k] = -speed * Math.sin(radians);
    v[k] = -speed * Math.cos(radians);
  }
  return { u, v };
}

/** The compass direction (0–360°) a travel vector comes from: the inverse of `toVectorField`. */
export function directionFromVector(u: number, v: number): number {
  return ((Math.atan2(-u, -v) * 180) / Math.PI + 360) % 360;
}
