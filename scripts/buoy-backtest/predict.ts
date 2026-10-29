import type { Spot } from '@glassy/shared';
import { exposure } from '../../src/app/domain/scoring/exposure';
import type { ModelHour } from './open-meteo';

/** Which wave trains a prediction combines. */
export type Trains = 'swell' | 'all';

/**
 * Height at the buoy from the model's wave trains, combined by energy (root-sum-square) as the
 * scoring model does (docs/scoring-model.md). With `spot`, each train is first scaled by
 * `exposure()`; without it, every train counts in full. `swell` combines the primary and secondary
 * swell, to compare with the buoy's swell height; `all` adds the wind waves, to compare with its
 * total height. No period factor and no shelter: buoys sit in deep water, where waves don't break.
 */
export function predictHeight(hour: ModelHour, trains: Trains, spot?: Spot): number {
  const share = (direction: number): number => (spot ? exposure(direction, spot) : 1);
  const parts: [height: number, direction: number][] = [
    [hour.swellHeight, hour.swellDirection],
    [hour.secondaryHeight, hour.secondaryDirection],
    ...(trains === 'all'
      ? [[hour.windWaveHeight, hour.windWaveDirection] as [number, number]]
      : []),
  ];
  return Math.sqrt(
    parts.reduce((sum, [height, direction]) => sum + (height * share(direction)) ** 2, 0),
  );
}
