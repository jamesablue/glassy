import { Pipe, type PipeTransform } from '@angular/core';
import type { TemperatureUnit } from '../../domain/models';
import { formatTemperature, NO_VALUE } from '../../domain/units';
import { isValue } from './is-value';

/**
 * A temperature in °C in the chosen unit, with the unit: `{{ 26 | temperature: 'f' }}` → "79°F".
 * A missing value reads "—".
 */
@Pipe({ name: 'temperature' })
export class TemperaturePipe implements PipeTransform {
  transform(celsius: number | null | undefined, unit: TemperatureUnit): string {
    return isValue(celsius) ? formatTemperature(celsius, unit) : NO_VALUE;
  }
}
