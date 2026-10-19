export type HeightUnit = 'ft' | 'm';
export type SpeedUnit = 'kt' | 'mph' | 'kmh' | 'ms';
export type TemperatureUnit = 'f' | 'c';

/** The display units a user has picked. Forecast values are always stored in SI units. */
export interface UnitSettings {
  readonly height: HeightUnit;
  readonly speed: SpeedUnit;
  readonly temperature: TemperatureUnit;
}
