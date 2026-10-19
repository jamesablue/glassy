import { Component, computed, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { PALETTES } from './domain/color';
import type { LatLon } from './domain/models';
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
 * The app root: the full-screen map with its layers bound to the stores, and the brand. The feature
 * panels join it in the next phase, beside the map rather than inside it.
 */
@Component({
  selector: 'glassy-root',
  imports: [
    RouterOutlet,
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
  protected readonly name = 'Glassy';
  protected readonly tagline = 'Oahu snorkel forecast';

  private readonly forecast = inject(ForecastStore);
  private readonly timeline = inject(TimelineStore);
  protected readonly mapUi = inject(MapUiStore);
  protected readonly conditions = inject(ConditionsStore);

  protected readonly hour = this.timeline.selectedHour;
  protected readonly grid = computed(() => this.forecast.bundle()?.grid.spec);
  /** Wind colours cover the land too; the sea layers keep the land dark. */
  protected readonly surfaceMode = computed(() =>
    this.mapUi.activeLayer() === 'wind' ? 'wind' : 'sea',
  );
  protected readonly field = computed(() => {
    const key = this.mapUi.activeFieldKey();
    return key ? this.forecast.bundle()?.grid.fields[key] : undefined;
  });
  protected readonly vectors = computed(() => {
    const key = this.mapUi.activeVectorKey();
    return key ? this.forecast.bundle()?.grid.vectors[key] : undefined;
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
}
