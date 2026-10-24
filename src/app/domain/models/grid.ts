// GridSpec is part of the snapshot contract, so it lives in shared/ at the repository root.
export type { GridSpec } from '@glassy/shared';

/** A point's fractional position on a grid, clamped to the grid's edges. */
export interface GridPosition {
  readonly row: number;
  readonly col: number;
  /** How far outside the grid the point lies, in cells (0 when inside). */
  readonly outside: number;
}

/**
 * A vector field split into east (`u`) and north (`v`) components, laid out like a scalar field.
 * Vectors point the way things travel, which is opposite to the meteorological "from" direction.
 */
export interface VectorField {
  readonly u: Float32Array;
  readonly v: Float32Array;
}
