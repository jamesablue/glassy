import { Pipe, type PipeTransform } from '@angular/core';
import type { HeightUnit } from '../../domain/models';
import { NO_VALUE, surfText } from '../../domain/units';
import { isValue } from './is-value';

/**
 * Surf height in metres as a surf-report range with its unit: `{{ 1 | surfRange: 'ft' }}` →
 * "3–4 ft", or "Flat". A missing value reads "—".
 */
@Pipe({ name: 'surfRange' })
export class SurfRangePipe implements PipeTransform {
  transform(meters: number | null | undefined, unit: HeightUnit): string {
    return isValue(meters) ? surfText(meters, unit) : NO_VALUE;
  }
}
