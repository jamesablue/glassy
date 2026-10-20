import { Component, computed, inject } from '@angular/core';
import { PALETTES } from './domain/color';
import type { LatLon } from './domain/models';
import { AppShellComponent } from './features';
import {
  BasemapLayerComponent,
  DepthLayerComponent,
  MapHostComponent,
  ParticleLayerComponent,
  PointInspectorComponent,
  ScalarFieldLayerComponent,
  SpotMarkersComponent,
  TerrainLayerComponent,
} from './map';
import { ConditionsStore, ForecastStore, MapUiStore, TimelineStore } from './state';

/**
 * The app root: the full-screen map with its layers bound to the stores, and the feature shell that
 * floats over it. The two sit side by side and share nothing but the stores, so neither the map nor
 * the features layer needs to import the other. The shell comes first in the page, so keyboard
 * focus and screen readers meet the panels before the map underneath them.
 */
@Component({
  selector: 'glassy-root',
  imports: [
    AppShellComponent,
    MapHostComponent,
    BasemapLayerComponent,
    TerrainLayerComponent,
    ScalarFieldLayerComponent,
    DepthLayerComponent,
    ParticleLayerComponent,
    SpotMarkersComponent,
    PointInspectorComponent,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly forecast = inject(ForecastStore);
  private readonly timeline = inject(TimelineStore);
  protected readonly mapUi = inject(MapUiStore);
  protected readonly conditions = inject(ConditionsStore);

  protected readonly hour = this.timeline.selectedHour;
  /** The map grid arrives after the spot forecast; until then the field and particles draw nothing. */
  protected readonly grid = computed(() => this.forecast.grid()?.spec);
  /** Wind colours cover the land too; the sea layers keep the land dark. */
  protected readonly surfaceMode = computed(() =>
    this.mapUi.activeLayer() === 'wind' ? 'wind' : 'sea',
  );
  protected readonly field = computed(() => {
    const key = this.mapUi.activeFieldKey();
    return key ? this.forecast.grid()?.fields[key] : undefined;
  });
  protected readonly vectors = computed(() => {
    const key = this.mapUi.activeVectorKey();
    return key ? this.forecast.grid()?.vectors[key] : undefined;
  });
  protected readonly palette = computed(() => {
    const layer = this.mapUi.activeLayerDefinition();
    return layer.kind === 'field' ? PALETTES[layer.palette] : undefined;
  });

  protected inspect(point: LatLon): void {
    this.mapUi.inspect(point);
  }

  protected selectSpot(id: string): void {
    this.mapUi.selectSpot(id);
  }

  protected hoverSpot(id: string | null): void {
    this.mapUi.hoverSpot(id);
  }
}
