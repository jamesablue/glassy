import type { GridSpec } from '../models';

/** The 1/8° forecast grid around Oahu: 11 rows × 15 columns, from 20.875°N 158.875°W. */
export const OAHU_GRID: GridSpec = {
  lat0: 20.875,
  lon0: -158.875,
  step: 0.125,
  rows: 11,
  cols: 15,
};
