import { Pipe, type PipeTransform } from '@angular/core';
import type { HeightUnit } from '../../domain/models';
import { formatDepth, NO_VALUE } from '../../domain/units';
import { isValue } from './is-value';

/**
 * A water depth in metres in the chosen height unit, with the unit:
 * `{{ 8.5 | depth: 'ft' }}` → "28 ft". A missing value reads "—".
 */
@Pipe({ name: 'depth' })
export class DepthPipe implements PipeTransform {
  transform(meters: number | null | undefined, unit: HeightUnit): string {
    return isValue(meters) ? formatDepth(meters, unit) : NO_VALUE;
  }
}
