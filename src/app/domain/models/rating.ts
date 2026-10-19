export type RatingLabel = 'Excellent' | 'Good' | 'Fair' | 'Poor' | 'Hazardous';

/** A named score band. A score gets the first band whose `min` it reaches. */
export interface Rating {
  readonly label: RatingLabel;
  /** Lowest score (inclusive) in this band. */
  readonly min: number;
  /** Badge colour, CSS hex. */
  readonly color: string;
}
