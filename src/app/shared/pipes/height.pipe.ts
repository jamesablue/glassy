import { Pipe, type PipeTransform } from '@angular/core';
import type { HeightUnit } from '../../domain/models';
import { formatHeight, NO_VALUE } from '../../domain/units';
import { isValue } from './is-value';

/**
 * A height in metres in the chosen unit, without the unit: `{{ 1 | height: 'ft' }}` → "3.3".
 * A missing value reads "—".
 */
@Pipe({ name: 'height' })
export class HeightPipe implements PipeTransform {
  transform(meters: number | null | undefined, unit: HeightUnit): string {
    return isValue(meters) ? formatHeight(meters, unit) : NO_VALUE;
  }
}
