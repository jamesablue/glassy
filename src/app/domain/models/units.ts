export const HEIGHT_UNITS = ['ft', 'm'] as const;
export const SPEED_UNITS = ['kt', 'mph', 'kmh', 'ms'] as const;
export const TEMPERATURE_UNITS = ['f', 'c'] as const;

export type HeightUnit = (typeof HEIGHT_UNITS)[number];
export type SpeedUnit = (typeof SPEED_UNITS)[number];
export type TemperatureUnit = (typeof TEMPERATURE_UNITS)[number];

/** The display units a user has picked. Forecast values are always stored in SI units. */
export interface UnitSettings {
  readonly height: HeightUnit;
  readonly speed: SpeedUnit;
  readonly temperature: TemperatureUnit;
}
