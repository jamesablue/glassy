import { Pipe, type PipeTransform } from '@angular/core';
import type { SpeedUnit } from '../../domain/models';
import { formatSpeed, NO_VALUE } from '../../domain/units';
import { isValue } from './is-value';

/**
 * A speed in m/s in the chosen unit as a whole number, without the unit:
 * `{{ 10 | speed: 'kt' }}` → "19". A missing value reads "—".
 */
@Pipe({ name: 'speed' })
export class SpeedPipe implements PipeTransform {
  transform(metersPerSecond: number | null | undefined, unit: SpeedUnit): string {
    return isValue(metersPerSecond) ? formatSpeed(metersPerSecond, unit) : NO_VALUE;
  }
}
