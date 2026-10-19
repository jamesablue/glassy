import { Pipe, type PipeTransform } from '@angular/core';
import { compassPoint, NO_VALUE } from '../../domain/units';
import { isValue } from './is-value';

/**
 * The nearest of the 16 compass points to a bearing: `{{ 100 | compass }}` → "E".
 * A missing bearing reads "—".
 */
@Pipe({ name: 'compass' })
export class CompassPipe implements PipeTransform {
  transform(degrees: number | null | undefined): string {
    return (isValue(degrees) && compassPoint(degrees)) || NO_VALUE;
  }
}
