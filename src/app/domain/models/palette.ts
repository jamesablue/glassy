/** An sRGB colour with 0–255 channels. */
export type Rgb = readonly [red: number, green: number, blue: number];

/** A colour anchored at a value in the palette's native unit. */
export type PaletteStop = readonly [value: number, color: Rgb];

export type PaletteId = 'wind' | 'waves' | 'period';

/** A colour ramp. Colours are interpolated linearly between stops, which are sorted by value. */
export interface Palette {
  /** Value the lookup table maps to its last entry. */
  readonly max: number;
  readonly stops: readonly [PaletteStop, ...PaletteStop[]];
}

/** Text colour that stays readable on top of a given background. */
export type Ink = 'dark' | 'light';
