import { computed, inject, Injectable } from '@angular/core';
import { SPOT_CATALOG } from '../core/spot-catalog.token';
import { sampleSpot } from '../domain/forecast';
import { legendSpec, type LegendSpec } from '../domain/legend';
import type { Conditions, Rating, Spot } from '../domain/models';
import {
  assessConditions,
  bestWindow,
  computeScoreMatrix,
  hazardsFor,
  rankSpots,
  rateScore,
  scoreAt,
  spotScores,
  type BestWindow,
  type Hazard,
  type ScoreMatrix,
} from '../domain/scoring';
import { ForecastStore } from './forecast.store';
import { MapUiStore } from './map-ui.store';
import { SettingsStore } from './settings.store';
import { TimelineStore } from './timeline.store';

/** A spot's conditions at the selected hour. */
export interface SpotConditions {
  readonly spot: Spot;
  readonly conditions: Conditions;
  readonly rating: Rating;
}

/** A row of the ranking: 1 is the best spot in the region at the selected hour. */
export interface RankedSpot extends SpotConditions {
  readonly rank: number;
}

/** What a map marker shows for a spot at the selected hour. */
export interface SpotPin {
  readonly id: string;
  readonly name: string;
  readonly lat: number;
  readonly lon: number;
  readonly score: number;
  /** The rating's badge colour, CSS hex. */
  readonly color: string;
  /** Estimated breaking surf at the spot, metres. */
  readonly surf: number;
  readonly selected: boolean;
}

/** One hour of a spot's score trend chart. */
export interface ScoreTrendPoint {
  readonly hour: number;
  /** Start of the hour, Unix seconds. */
  readonly time: number;
  readonly score: number;
  /** Estimated breaking surf at the spot, metres. */
  readonly surf: number;
  readonly isDay: boolean;
}

/** Everything the detail panel shows for the selected spot. */
export interface SpotDetail extends SpotConditions {
  /** Warnings for the selected hour, in display order. */
  readonly hazards: readonly Hazard[];
  /** Every forecast hour, for the trend chart. */
  readonly trend: readonly ScoreTrendPoint[];
  /** The best daylight session from now on, or `null` when none fits in the forecast. */
  readonly bestWindow: BestWindow | null;
}

/** The parts of the detail that do not depend on the selected hour. */
interface SpotOutlook {
  readonly trend: readonly ScoreTrendPoint[];
  readonly bestWindow: BestWindow | null;
}

/**
 * Read-only views computed from the other stores: the score matrix, the ranking, the map pins, the
 * selected spot's detail and the legend. It holds no state of its own, and every rule it applies
 * (scores, ratings, hazards, ranking, the best window, legend ticks) comes from `domain/`.
 *
 * The derivations are split by what they depend on, so each recomputes only when it must. The
 * score matrix is built once per forecast. Moving the timeline re-assesses each spot for one hour,
 * and the selected spot's trend and best window only change with the forecast or the selection.
 */
@Injectable({ providedIn: 'root' })
export class ConditionsStore {
  private readonly forecast = inject(ForecastStore);
  private readonly timeline = inject(TimelineStore);
  private readonly mapUi = inject(MapUiStore);
  private readonly settings = inject(SettingsStore);
  private readonly spots = inject(SPOT_CATALOG);

  /** Every spot's score for every hour, or `undefined` before a forecast loads. */
  readonly scoreMatrix = computed<ScoreMatrix | undefined>(() => {
    const bundle = this.forecast.bundle();
    return bundle ? computeScoreMatrix(this.spots, bundle.spots) : undefined;
  });

  /** Every spot at the selected hour, in catalog order. */
  private readonly spotsNow = computed<readonly SpotConditions[]>(() => {
    const bundle = this.forecast.bundle();
    if (!bundle || this.timeline.hourCount() === 0) return [];
    const hour = this.timeline.selectedHour();
    return this.spots.map((spot, index) => {
      const conditions = assessConditions(spot, sampleSpot(bundle.spots, index, hour));
      return { spot, conditions, rating: rateScore(conditions.score) };
    });
  });

  /** The spots in the region filter from best to worst at the selected hour. */
  readonly rankedSpots = computed<readonly RankedSpot[]>(() => {
    const matrix = this.scoreMatrix();
    const spotsNow = this.spotsNow();
    if (!matrix || spotsNow.length === 0) return [];
    const region = this.mapUi.regionFilter();
    const inRegion = this.spots.flatMap((spot, index) =>
      region === 'all' || spot.region === region ? [index] : [],
    );
    return rankSpots(matrix, this.timeline.selectedHour(), inRegion)
      .flatMap((index) => spotsNow[index] ?? [])
      .map((entry, position) => ({ ...entry, rank: position + 1 }));
  });

  /** One pin per spot at the selected hour, in catalog order. */
  readonly spotPins = computed<readonly SpotPin[]>(() => {
    const selectedId = this.mapUi.selectedSpotId();
    return this.spotsNow().map(({ spot, conditions, rating }) => ({
      id: spot.id,
      name: spot.name,
      lat: spot.lat,
      lon: spot.lon,
      score: conditions.score,
      color: rating.color,
      surf: conditions.surf,
      selected: spot.id === selectedId,
    }));
  });

  private readonly selectedOutlook = computed<SpotOutlook | null>(() => {
    const bundle = this.forecast.bundle();
    const matrix = this.scoreMatrix();
    const index = this.spots.findIndex((spot) => spot.id === this.mapUi.selectedSpotId());
    const spot = this.spots[index];
    if (!bundle || !matrix || !spot) return null;
    const trend = bundle.times.map((time, hour) => ({
      hour,
      time,
      score: scoreAt(matrix, index, hour),
      surf: assessConditions(spot, sampleSpot(bundle.spots, index, hour)).surf,
      isDay: bundle.isDay[hour] === true,
    }));
    const best = bestWindow(spotScores(matrix, index), bundle.isDay, this.timeline.nowHour());
    return { trend, bestWindow: best };
  });

  /** The selected spot at the selected hour, with its trend, or `null` when none is selected. */
  readonly selectedSpotDetail = computed<SpotDetail | null>(() => {
    const id = this.mapUi.selectedSpotId();
    const now = this.spotsNow().find((entry) => entry.spot.id === id);
    const outlook = this.selectedOutlook();
    if (!now || !outlook) return null;
    return { ...now, hazards: hazardsFor(now.conditions), ...outlook };
  });

  /** The legend for the active layer in the user's units. */
  readonly legendSpec = computed<LegendSpec>(() =>
    legendSpec(this.mapUi.activeLayer(), this.settings.units()),
  );
}
