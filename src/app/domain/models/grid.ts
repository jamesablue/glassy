/**
 * A regular latitude/longitude grid. Cell (row, col) is centred on
 * (`lat0 + row * step`, `lon0 + col * step`), so row 0 is the southern edge and col 0 the western.
 */
export interface GridSpec {
  readonly lat0: number;
  readonly lon0: number;
  /** Distance between neighbouring cell centres, degrees. */
  readonly step: number;
  readonly rows: number;
  readonly cols: number;
}

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
