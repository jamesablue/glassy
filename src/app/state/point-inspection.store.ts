import { computed, inject, Injectable } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { BathymetryClient } from '../data/noaa/bathymetry.client';
import { samplePoint } from '../domain/grid';
import type { LatLon, PointSample } from '../domain/models';
import { ForecastStore } from './forecast.store';
import { MapUiStore } from './map-ui.store';
import { TimelineStore } from './timeline.store';

/**
 * Ground elevation under the inspected point:
 *
 * - `loading`: NOAA has not answered yet
 * - `ready`: metres relative to sea level, negative under water (the depth is its negation)
 * - `no-data`: NOAA has no elevation there
 * - `error`: the lookup failed (no connection, or NOAA answered with an error); tapping again retries
 */
export type ElevationReading =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly meters: number }
  | { readonly status: 'no-data' }
  | { readonly status: 'error' };

/**
 * The forecast at the inspected point for the selected hour:
 *
 * - `loading`: the map grid has not loaded yet
 * - `unavailable`: the map grid could not be loaded (the spot forecast did)
 * - `outside`: the point is off the forecast grid
 * - `ready`: the gridded fields interpolated at the point
 */
export type PointForecast =
  | { readonly status: 'loading' }
  | { readonly status: 'unavailable' }
  | { readonly status: 'outside' }
  | { readonly status: 'ready'; readonly sample: PointSample };

/** Everything the map's point readout shows. */
export interface PointReading {
  readonly point: LatLon;
  /** Start of the selected hour, Unix seconds, or `undefined` before a forecast loads. */
  readonly time: number | undefined;
  readonly forecast: PointForecast;
  readonly elevation: ElevationReading;
}

/**
 * What is known about the map point the user tapped (`MapUiStore.inspectedPoint`): the forecast
 * there for the selected hour, and the depth or land height from NOAA.
 *
 * The elevation lookup is an `rxResource` keyed on the point, so tapping somewhere else cancels the
 * previous lookup and a late answer can never land in a readout for a different point. Clearing
 * the inspection makes the resource idle, so an answer still on its way is ignored.
 */
@Injectable({ providedIn: 'root' })
export class PointInspectionStore {
  private readonly mapUi = inject(MapUiStore);
  private readonly forecastStore = inject(ForecastStore);
  private readonly timeline = inject(TimelineStore);
  private readonly bathymetry = inject(BathymetryClient);

  private readonly lookup = rxResource({
    params: () => this.mapUi.inspectedPoint() ?? undefined,
    stream: ({ params }) => this.bathymetry.elevationAt(params.lat, params.lon),
  });

  /** The depth or land height at the inspected point, or `null` when nothing is inspected. */
  readonly elevation = computed<ElevationReading | null>(() => {
    if (!this.mapUi.inspectedPoint()) return null;
    switch (this.lookup.status()) {
      case 'error':
        return { status: 'error' };
      case 'resolved':
      case 'local': {
        const meters = this.lookup.value();
        return meters === undefined || Number.isNaN(meters)
          ? { status: 'no-data' }
          : { status: 'ready', meters };
      }
      default:
        return { status: 'loading' };
    }
  });

  /** The forecast at the inspected point and selected hour, or `null` when nothing is inspected. */
  readonly forecast = computed<PointForecast | null>(() => {
    const point = this.mapUi.inspectedPoint();
    if (!point) return null;
    const grid = this.forecastStore.grid();
    if (!grid) {
      return { status: this.forecastStore.gridStatus() === 'failed' ? 'unavailable' : 'loading' };
    }
    const sample = samplePoint(grid, this.timeline.selectedHour(), point.lat, point.lon);
    return sample ? { status: 'ready', sample } : { status: 'outside' };
  });

  /** The whole readout for the inspected point, or `null` when nothing is inspected. */
  readonly reading = computed<PointReading | null>(() => {
    const point = this.mapUi.inspectedPoint();
    const forecast = this.forecast();
    const elevation = this.elevation();
    if (!point || !forecast || !elevation) return null;
    return { point, time: this.timeline.selectedTime(), forecast, elevation };
  });
}
