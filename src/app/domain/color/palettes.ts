import type { Palette, PaletteId, Rgb } from '../models';

/**
 * Colour ramps for the forecast layers, in each field's native unit: m/s for wind, metres for
 * wave height and seconds for period.
 */
export const PALETTES: Readonly<Record<PaletteId, Palette>> = {
  wind: {
    max: 36,
    stops: [
      [0, [98, 113, 183]],
      [1, [57, 97, 159]],
      [3, [74, 148, 169]],
      [5, [77, 141, 123]],
      [7, [83, 165, 83]],
      [9, [53, 159, 53]],
      [11, [167, 157, 81]],
      [13, [159, 127, 58]],
      [15, [161, 108, 92]],
      [17, [129, 58, 78]],
      [19, [175, 80, 136]],
      [21, [117, 74, 147]],
      [24, [109, 97, 163]],
      [27, [68, 105, 141]],
      [29, [92, 144, 152]],
      [36, [125, 68, 165]],
    ],
  },
  waves: {
    max: 10,
    stops: [
      [0, [44, 52, 128]],
      [0.3, [46, 78, 168]],
      [0.6, [40, 116, 192]],
      [1, [36, 152, 198]],
      [1.5, [44, 182, 170]],
      [2, [74, 192, 112]],
      [2.5, [150, 198, 66]],
      [3, [222, 190, 58]],
      [4, [232, 132, 50]],
      [5, [212, 72, 70]],
      [6.5, [180, 50, 122]],
      [8, [138, 60, 172]],
      [10, [228, 206, 230]],
    ],
  },
  period: {
    max: 22,
    stops: [
      [0, [40, 48, 112]],
      [4, [46, 78, 166]],
      [7, [38, 136, 198]],
      [9, [44, 180, 170]],
      [11, [80, 194, 106]],
      [13, [170, 204, 66]],
      [15, [236, 176, 52]],
      [17, [230, 110, 56]],
      [19, [206, 60, 96]],
      [22, [160, 60, 170]],
    ],
  },
};

/**
 * The palette colour for a value, interpolated channel by channel between the two nearest stops
 * and rounded to whole channel values. Values outside the stops take the end colours.
 */
export function colorAt(palette: Palette, value: number): Rgb {
  let [lowValue, lowColor] = palette.stops[0];
  if (value <= lowValue) return lowColor;
  for (const [highValue, highColor] of palette.stops) {
    if (value <= highValue) {
      const t = (value - lowValue) / (highValue - lowValue);
      return [
        Math.round(lowColor[0] + (highColor[0] - lowColor[0]) * t),
        Math.round(lowColor[1] + (highColor[1] - lowColor[1]) * t),
        Math.round(lowColor[2] + (highColor[2] - lowColor[2]) * t),
      ];
    }
    lowValue = highValue;
    lowColor = highColor;
  }
  return lowColor;
}
